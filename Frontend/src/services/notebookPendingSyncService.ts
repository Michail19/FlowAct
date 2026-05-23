import type { NotebookPayloadDto } from '../components/notebook/notebookBackendTypes';
import { toBackendWorkflowRequest } from '../components/notebook/backendWorkflowMapper';
import { getAuthSession } from '../auth/authSession';
import { ApiError, apiClient } from './apiClient';
import { saveNotebookLocally } from './notebookStorage';
import {
    getNotebookSyncErrorMessage,
    isRetryableNotebookSyncError,
    listPendingNotebookSyncItems,
    markNotebookSyncAttempt,
    removeNotebookSyncItem,
} from './notebookSyncQueue';
import {
    getOriginalNotebookId,
    getOriginalWorkflowId,
    isPendingNotebookId,
    isPendingWorkflowId,
} from './pendingBackendIds';
import type {
    BackendWorkflowUpsertRequest,
    WorkflowRequest,
    WorkflowResponse,
} from './workflowApiTypes';
import type {
    NotebookRequest,
    NotebookResponse,
} from './notebookApi';

const NOTEBOOK_SYNC_INTERVAL_MS = 10 * 60 * 1000;
const NOTEBOOKS_ENDPOINT = '/v1/notebooks';

let syncIntervalId: number | null = null;
let isSyncRunning = false;
let onlineHandler: (() => void) | null = null;

function getWorkflowEndpoint(notebookId: string) {
    return `/v1/notebooks/${notebookId}/workflows`;
}

function isNotFoundError(error: unknown) {
    return error instanceof ApiError && error.status === 404;
}

function toWorkflowRequest(payload: BackendWorkflowUpsertRequest): WorkflowRequest {
    return {
        name: payload.name,
        description:
            typeof payload.metadata?.description === 'string'
                ? payload.metadata.description
                : null,
        blocks: payload.blocks,
        connections: payload.connections,
        metadata: payload.metadata,
    };
}

async function upsertNotebook(
    payload: NotebookPayloadDto,
    request: NotebookRequest,
) {
    const originalNotebookId = getOriginalNotebookId(payload.serverNotebookId);

    if (originalNotebookId) {
        try {
            return await apiClient.put<NotebookResponse>(
                `${NOTEBOOKS_ENDPOINT}/${originalNotebookId}`,
                request,
            );
        } catch (error) {
            if (isNotFoundError(error)) {
                return apiClient.post<NotebookResponse>(NOTEBOOKS_ENDPOINT, request);
            }

            if (!isPendingNotebookId(payload.serverNotebookId) || !isRetryableNotebookSyncError(error)) {
                throw error;
            }
        }
    }

    return apiClient.post<NotebookResponse>(NOTEBOOKS_ENDPOINT, request);
}

async function upsertWorkflow(
    serverNotebookId: string,
    payload: NotebookPayloadDto,
    request: BackendWorkflowUpsertRequest,
) {
    const originalWorkflowId = getOriginalWorkflowId(payload.workflowId);
    const workflowRequest = toWorkflowRequest(request);

    if (originalWorkflowId) {
        try {
            return await apiClient.put<WorkflowResponse>(
                `${getWorkflowEndpoint(serverNotebookId)}/${originalWorkflowId}`,
                workflowRequest,
            );
        } catch (error) {
            if (isNotFoundError(error)) {
                return apiClient.post<WorkflowResponse>(
                    getWorkflowEndpoint(serverNotebookId),
                    workflowRequest,
                );
            }

            if (!isPendingWorkflowId(payload.workflowId) || !isRetryableNotebookSyncError(error)) {
                throw error;
            }
        }
    }

    return apiClient.post<WorkflowResponse>(
        getWorkflowEndpoint(serverNotebookId),
        workflowRequest,
    );
}

async function syncNotebookPayload(payload: NotebookPayloadDto) {
    if (!payload.id) {
        return null;
    }

    const notebookId = payload.id;
    const notebookRequest = {
        name: payload.title,
        description: `FlowAct notebook: ${payload.title}`,
    };

    const syncedNotebook = await upsertNotebook(payload, notebookRequest);
    const serverNotebookId = syncedNotebook.id;

    const payloadWithServerNotebookId: NotebookPayloadDto = {
        ...payload,
        serverNotebookId,
    };

    const workflowRequest = toBackendWorkflowRequest(payloadWithServerNotebookId);
    const syncedWorkflow = await upsertWorkflow(
        serverNotebookId,
        payloadWithServerNotebookId,
        workflowRequest,
    );

    const syncedPayload: NotebookPayloadDto = {
        ...payloadWithServerNotebookId,
        workflowId: syncedWorkflow.id,
        workflowStatus: syncedWorkflow.status,
        updatedAt: new Date().toISOString(),
    };

    saveNotebookLocally(syncedPayload, { enqueueSync: false });
    removeNotebookSyncItem(notebookId);

    return syncedPayload;
}

export async function flushPendingNotebookSyncQueue() {
    const session = getAuthSession();

    if (!session.isAuthenticated || !session.accessToken) {
        return;
    }

    if (isSyncRunning) {
        return;
    }

    isSyncRunning = true;

    try {
        const queue = listPendingNotebookSyncItems();

        for (const item of queue) {
            try {
                await syncNotebookPayload(item.payload);
            } catch (error) {
                markNotebookSyncAttempt(
                    item.notebookId,
                    getNotebookSyncErrorMessage(error),
                );
            }
        }
    } finally {
        isSyncRunning = false;
    }
}

export function startNotebookPendingSyncWorker() {
    if (syncIntervalId !== null) {
        return;
    }

    void flushPendingNotebookSyncQueue();

    onlineHandler = () => {
        void flushPendingNotebookSyncQueue();
    };

    window.addEventListener('online', onlineHandler);

    syncIntervalId = window.setInterval(() => {
        void flushPendingNotebookSyncQueue();
    }, NOTEBOOK_SYNC_INTERVAL_MS);
}

export function stopNotebookPendingSyncWorker() {
    if (syncIntervalId === null) {
        return;
    }

    window.clearInterval(syncIntervalId);
    syncIntervalId = null;

    if (onlineHandler) {
        window.removeEventListener('online', onlineHandler);
        onlineHandler = null;
    }
}

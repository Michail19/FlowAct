import type { NotebookPayloadDto } from '../components/notebook/notebookBackendTypes';
import { toBackendWorkflowRequest } from '../components/notebook/backendWorkflowMapper';
import { getAuthSession } from '../auth/authSession';
import { apiClient } from './apiClient';
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
let isBeforeUnloadListenerRegistered = false;

function getWorkflowEndpoint(notebookId: string) {
    return `/v1/notebooks/${notebookId}/workflows`;
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

function handleBeforeUnload(event: BeforeUnloadEvent) {
    if (listPendingNotebookSyncItems().length === 0) {
        return;
    }

    event.preventDefault();
    event.returnValue = '';
}

async function upsertNotebook(
    payload: NotebookPayloadDto,
    request: NotebookRequest,
) {
    const originalNotebookId = getOriginalNotebookId(payload.serverNotebookId);

    if (originalNotebookId && !isPendingNotebookId(payload.serverNotebookId)) {
        return apiClient.put<NotebookResponse>(
            `${NOTEBOOKS_ENDPOINT}/${originalNotebookId}`,
            request,
        );
    }

    if (originalNotebookId && isPendingNotebookId(payload.serverNotebookId)) {
        try {
            return await apiClient.put<NotebookResponse>(
                `${NOTEBOOKS_ENDPOINT}/${originalNotebookId}`,
                request,
            );
        } catch (error) {
            if (!isRetryableNotebookSyncError(error)) {
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

    if (originalWorkflowId && !isPendingWorkflowId(payload.workflowId)) {
        return apiClient.put<WorkflowResponse>(
            `${getWorkflowEndpoint(serverNotebookId)}/${originalWorkflowId}`,
            toWorkflowRequest(request),
        );
    }

    if (originalWorkflowId && isPendingWorkflowId(payload.workflowId)) {
        try {
            return await apiClient.put<WorkflowResponse>(
                `${getWorkflowEndpoint(serverNotebookId)}/${originalWorkflowId}`,
                toWorkflowRequest(request),
            );
        } catch (error) {
            if (!isRetryableNotebookSyncError(error)) {
                throw error;
            }
        }
    }

    return apiClient.post<WorkflowResponse>(
        getWorkflowEndpoint(serverNotebookId),
        toWorkflowRequest(request),
    );
}

async function syncNotebookPayload(payload: NotebookPayloadDto) {
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
    removeNotebookSyncItem(payload.id);

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

    const handleOnline = () => {
        void flushPendingNotebookSyncQueue();
    };

    window.addEventListener('online', handleOnline);

    if (!isBeforeUnloadListenerRegistered) {
        window.addEventListener('beforeunload', handleBeforeUnload);
        isBeforeUnloadListenerRegistered = true;
    }

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
}

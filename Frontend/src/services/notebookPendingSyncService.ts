import type { NotebookPayloadDto } from '../components/notebook/notebookBackendTypes';
import { toBackendWorkflowRequest } from '../components/notebook/backendWorkflowMapper';
import { getAuthSession } from '../auth/authSession';
import { notebookApi } from './notebookApi';
import { workflowApi } from './workflowApi';
import { saveNotebookLocally } from './notebookStorage';
import {
    getNotebookSyncErrorMessage,
    isRetryableNotebookSyncError,
    listPendingNotebookSyncItems,
    markNotebookSyncAttempt,
    removeNotebookSyncItem,
} from './notebookSyncQueue';

const NOTEBOOK_SYNC_INTERVAL_MS = 10 * 60 * 1000;

let syncIntervalId: number | null = null;
let isSyncRunning = false;

async function syncNotebookPayload(payload: NotebookPayloadDto) {
    const notebookRequest = {
        name: payload.title,
        description: `FlowAct notebook: ${payload.title}`,
    };

    let serverNotebookId = payload.serverNotebookId;

    if (serverNotebookId) {
        await notebookApi.updateNotebook(serverNotebookId, notebookRequest);
    } else {
        const createdNotebook = await notebookApi.createNotebook(notebookRequest);
        serverNotebookId = createdNotebook.id;
    }

    const payloadWithServerNotebookId: NotebookPayloadDto = {
        ...payload,
        serverNotebookId,
    };

    const workflowRequest = toBackendWorkflowRequest(payloadWithServerNotebookId);
    let workflowId = payloadWithServerNotebookId.workflowId;
    let workflowStatus = payloadWithServerNotebookId.workflowStatus;

    if (workflowId) {
        const updatedWorkflow = await workflowApi.updateWorkflow(
            serverNotebookId,
            workflowId,
            workflowRequest,
        );

        workflowId = updatedWorkflow.id;
        workflowStatus = updatedWorkflow.status;
    } else {
        const createdWorkflow = await workflowApi.createWorkflow(
            serverNotebookId,
            workflowRequest,
        );

        workflowId = createdWorkflow.id;
        workflowStatus = createdWorkflow.status;
    }

    const syncedPayload: NotebookPayloadDto = {
        ...payloadWithServerNotebookId,
        workflowId,
        workflowStatus,
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

                if (!isRetryableNotebookSyncError(error)) {
                    continue;
                }
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

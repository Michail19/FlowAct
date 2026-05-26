import { apiClient } from './apiClient';
import { createPendingWorkflowId, isPendingNotebookId, isPendingWorkflowId } from './pendingBackendIds';
import { isRetryableNotebookSyncError } from './notebookSyncQueue';
import { createPersistenceError } from './persistenceError';
import type {
    BackendWorkflowUpsertRequest,
    WorkflowRequest,
    WorkflowResponse,
    WorkflowShortResponse,
    WorkflowValidationResponse,
} from './workflowApiTypes';

const NOTEBOOK_BACKEND_IDS_STORAGE_KEY = 'flowact:notebook-backend-ids';

function readBackendNotebookIds() {
    try {
        const value = window.localStorage.getItem(NOTEBOOK_BACKEND_IDS_STORAGE_KEY);
        const parsedValue = value ? JSON.parse(value) : {};

        if (
            parsedValue &&
            typeof parsedValue === 'object' &&
            !Array.isArray(parsedValue)
        ) {
            return parsedValue as Record<string, string>;
        }
    } catch {
        // ignore
    }

    return {};
}

function rememberBackendNotebookId(localNotebookId?: string | null, backendNotebookId?: string | null) {
    if (!localNotebookId || !backendNotebookId || localNotebookId === backendNotebookId) {
        return;
    }

    const ids = readBackendNotebookIds();
    ids[localNotebookId] = backendNotebookId;

    window.localStorage.setItem(
        NOTEBOOK_BACKEND_IDS_STORAGE_KEY,
        JSON.stringify(ids),
    );
}

function resolveBackendNotebookId(notebookId: string) {
    return readBackendNotebookIds()[notebookId] ?? notebookId;
}

function getWorkflowEndpoint(notebookId: string) {
    return `/v1/notebooks/${resolveBackendNotebookId(notebookId)}/workflows`;
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

function createLocalWorkflowResponse(
    notebookId: string,
    payload: BackendWorkflowUpsertRequest,
    workflowId = createPendingWorkflowId(payload.id),
): WorkflowResponse {
    const now = new Date().toISOString();

    return {
        id: workflowId,
        notebookId,
        name: payload.name,
        description:
            typeof payload.metadata?.description === 'string'
                ? payload.metadata.description
                : null,
        metadata: payload.metadata,
        status: 'DRAFT',
        blocks: payload.blocks,
        connections: payload.connections,
        createdAt: now,
        updatedAt: now,
    };
}

export const workflowApi = {
    async createWorkflow(notebookId: string, payload: BackendWorkflowUpsertRequest) {
        if (isPendingNotebookId(notebookId)) {
            return createLocalWorkflowResponse(notebookId, payload);
        }

        try {
            const response = await apiClient.post<WorkflowResponse>(
                getWorkflowEndpoint(notebookId),
                toWorkflowRequest(payload),
            );

            rememberBackendNotebookId(notebookId, response.notebookId);
            rememberBackendNotebookId(payload.notebookId, response.notebookId);

            return response;
        } catch (error) {
            if (isRetryableNotebookSyncError(error)) {
                return createLocalWorkflowResponse(notebookId, payload);
            }

            throw createPersistenceError('workflow', error);
        }
    },

    async updateWorkflow(
        notebookId: string,
        workflowId: string,
        payload: BackendWorkflowUpsertRequest,
    ) {
        if (isPendingNotebookId(notebookId) || isPendingWorkflowId(workflowId)) {
            return createLocalWorkflowResponse(notebookId, payload, workflowId);
        }

        try {
            const response = await apiClient.put<WorkflowResponse>(
                `${getWorkflowEndpoint(notebookId)}/${workflowId}`,
                toWorkflowRequest(payload),
            );

            rememberBackendNotebookId(notebookId, response.notebookId);
            rememberBackendNotebookId(payload.notebookId, response.notebookId);

            return response;
        } catch (error) {
            if (isRetryableNotebookSyncError(error)) {
                return createLocalWorkflowResponse(
                    notebookId,
                    payload,
                    createPendingWorkflowId(workflowId),
                );
            }

            throw createPersistenceError('workflow', error);
        }
    },

    getWorkflow(notebookId: string, workflowId: string) {
        return apiClient.get<WorkflowResponse>(
            `${getWorkflowEndpoint(notebookId)}/${workflowId}`,
        );
    },

    getWorkflows(notebookId: string) {
        return apiClient.get<WorkflowShortResponse[]>(getWorkflowEndpoint(notebookId));
    },

    async validateWorkflow(notebookId: string, workflowId: string) {
        try {
            return await apiClient.post<WorkflowValidationResponse>(
                `${getWorkflowEndpoint(notebookId)}/${workflowId}/validate`,
            );
        } catch (error) {
            throw createPersistenceError('validation', error);
        }
    },

    async activateWorkflow(notebookId: string, workflowId: string) {
        try {
            return await apiClient.post<WorkflowResponse>(
                `${getWorkflowEndpoint(notebookId)}/${workflowId}/activate`,
            );
        } catch (error) {
            throw createPersistenceError('activation', error);
        }
    },

    archiveWorkflow(notebookId: string, workflowId: string) {
        return apiClient.post<WorkflowResponse>(
            `${getWorkflowEndpoint(notebookId)}/${workflowId}/archive`,
        );
    },
};

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
            return await apiClient.post<WorkflowResponse>(
                getWorkflowEndpoint(notebookId),
                toWorkflowRequest(payload),
            );
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
            return await apiClient.put<WorkflowResponse>(
                `${getWorkflowEndpoint(notebookId)}/${workflowId}`,
                toWorkflowRequest(payload),
            );
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

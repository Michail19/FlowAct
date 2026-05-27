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

function getWorkflowEndpoint(
    notebookId: string,
    payload?: BackendWorkflowUpsertRequest,
) {
    const resolvedNotebookId = payload?.notebookId ?? notebookId;

    return `/v1/notebooks/${resolvedNotebookId}/workflows`;
}

function getWorkflowId(
    workflowId: string,
    payload?: BackendWorkflowUpsertRequest,
) {
    return payload?.id ?? workflowId;
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

// function createLocalWorkflowResponse(
//     notebookId: string,
//     payload: BackendWorkflowUpsertRequest,
//     workflowId = createPendingWorkflowId(payload.id),
// ): WorkflowResponse {
//     const now = new Date().toISOString();
//
//     return {
//         id: workflowId,
//         notebookId,
//         name: payload.name,
//         description:
//             typeof payload.metadata?.description === 'string'
//                 ? payload.metadata.description
//                 : null,
//         metadata: payload.metadata,
//         status: 'DRAFT',
//         blocks: payload.blocks,
//         connections: payload.connections,
//         createdAt: now,
//         updatedAt: now,
//     };
// }

export const workflowApi = {
    createWorkflow(notebookId: string, payload: BackendWorkflowUpsertRequest) {
        return apiClient.post<WorkflowResponse>(
            getWorkflowEndpoint(notebookId, payload),
            toWorkflowRequest(payload),
        );
    },

    updateWorkflow(
        notebookId: string,
        workflowId: string,
        payload: BackendWorkflowUpsertRequest,
    ) {
        return apiClient.put<WorkflowResponse>(
            `${getWorkflowEndpoint(notebookId, payload)}/${getWorkflowId(workflowId, payload)}`,
            toWorkflowRequest(payload),
        );
    },

    getWorkflow(notebookId: string, workflowId: string) {
        return apiClient.get<WorkflowResponse>(
            `${getWorkflowEndpoint(notebookId)}/${workflowId}`,
        );
    },

    getWorkflows(notebookId: string) {
        return apiClient.get<WorkflowShortResponse[]>(getWorkflowEndpoint(notebookId));
    },

    validateWorkflow(notebookId: string, workflowId: string) {
        return apiClient.post<WorkflowValidationResponse>(
            `${getWorkflowEndpoint(notebookId)}/${workflowId}/validate`,
        );
    },

    activateWorkflow(notebookId: string, workflowId: string) {
        return apiClient.post<WorkflowResponse>(
            `${getWorkflowEndpoint(notebookId)}/${workflowId}/activate`,
        );
    },

    archiveWorkflow(notebookId: string, workflowId: string) {
        return apiClient.post<WorkflowResponse>(
            `${getWorkflowEndpoint(notebookId)}/${workflowId}/archive`,
        );
    },
};

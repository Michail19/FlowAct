import { apiClient } from './apiClient';
import type {
    BackendWorkflowUpsertRequest,
    WorkflowRequest,
    WorkflowResponse,
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
    };
}

export const workflowApi = {
    createWorkflow(notebookId: string, payload: BackendWorkflowUpsertRequest) {
        return apiClient.post<WorkflowResponse>(
            getWorkflowEndpoint(notebookId),
            toWorkflowRequest(payload),
        );
    },

    updateWorkflow(
        notebookId: string,
        workflowId: string,
        payload: BackendWorkflowUpsertRequest,
    ) {
        return apiClient.put<WorkflowResponse>(
            `${getWorkflowEndpoint(notebookId)}/${workflowId}`,
            toWorkflowRequest(payload),
        );
    },

    getWorkflow(notebookId: string, workflowId: string) {
        return apiClient.get<WorkflowResponse>(
            `${getWorkflowEndpoint(notebookId)}/${workflowId}`,
        );
    },

    getWorkflows(notebookId: string) {
        return apiClient.get<WorkflowResponse[]>(getWorkflowEndpoint(notebookId));
    },

    validateWorkflow(notebookId: string, workflowId: string) {
        return apiClient.post(
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

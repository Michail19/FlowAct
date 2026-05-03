import { apiClient } from './apiClient';
import type {
    CreateExecutionRequest,
    ExecutionLogResponse,
    ExecutionResponse,
    ResumeExecutionRequest,
} from './workflowApiTypes';

function getWorkflowExecutionEndpoint(notebookId: string, workflowId: string) {
    return `/v1/notebooks/${notebookId}/workflows/${workflowId}/executions`;
}

export const executionApi = {
    run(
        notebookId: string,
        workflowId: string,
        request: CreateExecutionRequest,
    ) {
        return apiClient.post<ExecutionResponse>(
            getWorkflowExecutionEndpoint(notebookId, workflowId),
            request,
        );
    },

    getExecutions(notebookId: string, workflowId: string) {
        return apiClient.get<ExecutionResponse[]>(
            getWorkflowExecutionEndpoint(notebookId, workflowId),
        );
    },

    getById(notebookId: string, workflowId: string, executionId: string) {
        return apiClient.get<ExecutionResponse>(
            `${getWorkflowExecutionEndpoint(notebookId, workflowId)}/${executionId}`,
        );
    },

    getLogs(notebookId: string, workflowId: string, executionId: string) {
        return apiClient.get<ExecutionLogResponse[]>(
            `${getWorkflowExecutionEndpoint(notebookId, workflowId)}/${executionId}/logs`,
        );
    },

    retry(notebookId: string, workflowId: string, executionId: string) {
        return apiClient.post<ExecutionResponse>(
            `${getWorkflowExecutionEndpoint(notebookId, workflowId)}/${executionId}/retry`,
        );
    },

    resume(
        notebookId: string,
        workflowId: string,
        executionId: string,
        request: ResumeExecutionRequest,
    ) {
        return apiClient.post<ExecutionResponse>(
            `${getWorkflowExecutionEndpoint(notebookId, workflowId)}/${executionId}/resume`,
            request,
        );
    },

    cancel(notebookId: string, workflowId: string, executionId: string) {
        return apiClient.post<ExecutionResponse>(
            `${getWorkflowExecutionEndpoint(notebookId, workflowId)}/${executionId}/cancel`,
        );
    },
};

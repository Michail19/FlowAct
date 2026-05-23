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

function requireExecutionId(executionId: string | undefined) {
    if (!executionId) {
        throw new Error('Backend execution id is missing. Run the workflow on backend before using this action.');
    }

    return executionId;
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

    getById(notebookId: string, workflowId: string, executionId: string | undefined) {
        const safeExecutionId = requireExecutionId(executionId);

        return apiClient.get<ExecutionResponse>(
            `${getWorkflowExecutionEndpoint(notebookId, workflowId)}/${safeExecutionId}`,
        );
    },

    getLogs(notebookId: string, workflowId: string, executionId: string | undefined) {
        const safeExecutionId = requireExecutionId(executionId);

        return apiClient.get<ExecutionLogResponse[]>(
            `${getWorkflowExecutionEndpoint(notebookId, workflowId)}/${safeExecutionId}/logs`,
        );
    },

    retry(notebookId: string, workflowId: string, executionId: string | undefined) {
        const safeExecutionId = requireExecutionId(executionId);

        return apiClient.post<ExecutionResponse>(
            `${getWorkflowExecutionEndpoint(notebookId, workflowId)}/${safeExecutionId}/retry`,
        );
    },

    resume(
        notebookId: string,
        workflowId: string,
        executionId: string | undefined,
        request: ResumeExecutionRequest,
    ) {
        const safeExecutionId = requireExecutionId(executionId);

        return apiClient.post<ExecutionResponse>(
            `${getWorkflowExecutionEndpoint(notebookId, workflowId)}/${safeExecutionId}/resume`,
            request,
        );
    },

    cancel(notebookId: string, workflowId: string, executionId: string | undefined) {
        const safeExecutionId = requireExecutionId(executionId);

        return apiClient.post<ExecutionResponse>(
            `${getWorkflowExecutionEndpoint(notebookId, workflowId)}/${safeExecutionId}/cancel`,
        );
    },
};
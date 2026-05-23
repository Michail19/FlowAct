import type { NotebookBlockStatus, NotebookBlockType } from './notebookTypes';

export type WorkflowExecutionStatus =
    | 'idle'
    | 'created'
    | 'validating'
    | 'pending'
    | 'ready'
    | 'running'
    | 'waiting'
    | 'success'
    | 'error'
    | 'cancelling'
    | 'cancelled'
    | 'skipped';

export type WorkflowExecutionFinalStatus = 'success' | 'error' | 'cancelled';

export type ApiExecutionStatus =
    | 'CREATED'
    | 'VALIDATING'
    | 'PENDING'
    | 'READY'
    | 'RUNNING'
    | 'WAITING'
    | 'SUCCESS'
    | 'FAILED'
    | 'CANCELLING'
    | 'CANCELLED';

export type ApiExecutionLogStatus =
    | 'PENDING'
    | 'RUNNING'
    | 'SUCCESS'
    | 'FAILED'
    | 'SKIPPED'
    | 'WAITING';

export type WorkflowRunRequest = {
    requestId: number;
    serverNotebookId?: string;
    workflowId?: string;
    inputData?: Record<string, unknown>;
};

export type NotebookExecutionLogLevel = 'info' | 'success' | 'warning' | 'error';

export type NotebookExecutionLog = {
    id: string;
    level: NotebookExecutionLogLevel;
    status: WorkflowExecutionStatus;
    blockId?: string;
    blockTitle?: string;
    message: string;
    input?: string;
    rawInput?: string;
    output?: string;
    rawOutput?: string;
    outputFormat?: 'text' | 'json';
    error?: string | null;
    createdAt: string;
};

export type WorkflowExecutionResult = {
    id: string;
    status: WorkflowExecutionFinalStatus;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    totalBlocks: number;
    completedBlocks: number;
    failedBlocks: number;
    warningsCount: number;
    errorsCount: number;
    summary: string;
    output: string;
    outputFormat?: 'text' | 'json';
    rawOutput?: string;
};

export type NotebookBlockInspectionTarget = {
    blockId: string;
    blockTitle: string;
    blockType: NotebookBlockType;
    blockStatus: NotebookBlockStatus;
};

export function mapApiExecutionStatus(status: ApiExecutionStatus): WorkflowExecutionStatus {
    switch (status) {
        case 'CREATED':
            return 'created';
        case 'VALIDATING':
            return 'validating';
        case 'PENDING':
            return 'pending';
        case 'READY':
            return 'ready';
        case 'RUNNING':
            return 'running';
        case 'WAITING':
            return 'waiting';
        case 'SUCCESS':
            return 'success';
        case 'FAILED':
            return 'error';
        case 'CANCELLING':
            return 'cancelling';
        case 'CANCELLED':
            return 'cancelled';
    }
}

export function mapApiExecutionLogStatus(
    status: ApiExecutionLogStatus,
): NotebookBlockStatus {
    switch (status) {
        case 'PENDING':
            return 'pending';
        case 'RUNNING':
            return 'running';
        case 'SUCCESS':
            return 'success';
        case 'FAILED':
            return 'error';
        case 'SKIPPED':
            return 'skipped';
        case 'WAITING':
            return 'waiting';
    }
}

export type WorkflowExecutionTarget = {
    serverNotebookId: string;
    workflowId: string;
    executionId?: string;
};
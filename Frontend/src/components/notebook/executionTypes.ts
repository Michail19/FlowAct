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
    | 'cancelled';

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
};

export type NotebookExecutionLogLevel = 'info' | 'success' | 'warning' | 'error';

export type NotebookExecutionLog = {
    id: string;
    level: NotebookExecutionLogLevel;
    status: WorkflowExecutionStatus;
    blockId?: string;
    blockTitle?: string;
    message: string;
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

export function mapApiExecutionLogStatus(status: ApiExecutionLogStatus) {
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

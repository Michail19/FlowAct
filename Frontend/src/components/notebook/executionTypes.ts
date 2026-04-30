export type WorkflowExecutionStatus = 'idle' | 'running' | 'success' | 'error';

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

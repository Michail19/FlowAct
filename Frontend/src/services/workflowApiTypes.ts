import type {
    ApiExecutionLogStatus,
    ApiExecutionStatus,
} from '../components/notebook/executionTypes';

export type BackendJsonValue =
    | string
    | number
    | boolean
    | null
    | BackendJsonObject
    | BackendJsonValue[];

export type BackendJsonObject = {
    [key: string]: BackendJsonValue | undefined;
};

export type BackendBlockType =
    | 'START'
    | 'END'
    | 'INPUT'
    | 'IF'
    | 'SWITCH'
    | 'MERGE'
    | 'SET_VARIABLE'
    | 'MAP'
    | 'FILTER'
    | 'TRANSFORM_JSON'
    | 'HTTP_REQUEST'
    | 'LLM_REQUEST'
    | 'ML_REQUEST'
    | 'DELAY'
    | 'WAIT'
    | 'WEBHOOK';

export type BackendWorkflowBlockPosition = {
    x: number;
    y: number;
};

export type BackendWorkflowBlockRequest = {
    id: string;
    type: BackendBlockType;
    name: string;
    position: BackendWorkflowBlockPosition;
    config: BackendJsonObject;
};

export type BackendWorkflowConnectionRequest = {
    id: string;
    fromBlockId: string;
    toBlockId: string;
    condition?: string | null;
};

export type BackendWorkflowUpsertRequest = {
    id?: string;
    notebookId?: string;
    name: string;
    blocks: BackendWorkflowBlockRequest[];
    connections: BackendWorkflowConnectionRequest[];
    metadata?: BackendJsonObject;
};

export type CreateExecutionRequest = {
    inputData: BackendJsonObject;
};

export type ResumeExecutionRequest = {
    resumePayload: BackendJsonValue;
};

export type ExecutionResponse = {
    id: string;
    workflowId: string;
    startedByUserId: string;
    status: ApiExecutionStatus;
    inputData: BackendJsonObject;
    outputData: BackendJsonObject | null;
    errorMessage: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

export type ExecutionLogResponse = {
    id: string;
    executionId: string;
    blockId: string;
    status: ApiExecutionLogStatus;
    output: BackendJsonObject | null;
    error: string | null;
    createdAt: string;
};

export type WorkflowStatus =
    | 'DRAFT'
    | 'ACTIVE'
    | 'ARCHIVED';

export type WorkflowResponse = {
    id: string;
    notebookId: string;
    name: string;
    description: string | null;
    status: WorkflowStatus;
    blocks: BackendWorkflowBlockRequest[];
    connections: BackendWorkflowConnectionRequest[];
    createdAt: string;
    updatedAt: string;
};

export type WorkflowRequest = {
    name: string;
    description?: string | null;
    blocks: BackendWorkflowBlockRequest[];
    connections: BackendWorkflowConnectionRequest[];
};

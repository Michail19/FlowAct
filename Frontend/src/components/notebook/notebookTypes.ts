import type { Node } from '@xyflow/react';

export type NotebookBlockType =
    | 'start'
    | 'end'
    | 'ai'
    | 'condition'
    | 'action'
    | 'database'
    | 'email'
    | 'log'
    | 'http'
    | 'loop'
    | 'merge';

export type NotebookBlockStatus =
    | 'idle'
    | 'pending'
    | 'running'
    | 'success'
    | 'error'
    | 'skipped'
    | 'waiting';

export type AiBlockConfig = {
    prompt: string;
    models: string[];
};

export type ConditionOperator =
    | 'equals'
    | 'notEquals'
    | 'contains'
    | 'greaterThan'
    | 'lessThan'
    | 'exists';

export type ConditionBlockConfig = {
    leftValue: string;
    operator: ConditionOperator;
    rightValue: string;
};

export type ActionBlockConfig = {
    actionType: 'format' | 'transform' | 'custom';
    parameters: string;
};

export type DatabaseBlockConfig = {
    operation: 'select' | 'insert' | 'update' | 'delete';
    tableName: string;
    query: string;
    payload: string;
};

export type EmailBlockConfig = {
    recipient: string;
    subject: string;
    body: string;
};

export type LogBlockConfig = {
    level: 'info' | 'warning' | 'error';
    messageTemplate: string;
};

export type HttpBlockConfig = {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: string;
    headers: string;
    body: string;
};

export type LoopBlockConfig = {
    collectionPath: string;
    itemName: string;
    mode: 'map' | 'forEach';
};

export type MergeBlockConfig = {
    mode: 'passThrough' | 'combine';
};

export type NotebookBlockConfig = {
    condition?: ConditionBlockConfig;
    action?: ActionBlockConfig;
    database?: DatabaseBlockConfig;
    email?: EmailBlockConfig;
    log?: LogBlockConfig;
    http?: HttpBlockConfig;
    loop?: LoopBlockConfig;
    merge?: MergeBlockConfig;
};

export type NotebookBlockData = {
    title: string;
    subtitle?: string;
    description?: string;
    blockType: NotebookBlockType;
    status?: NotebookBlockStatus;
    icon?: string;
    meta?: string;
    aiConfig?: AiBlockConfig;
    config?: NotebookBlockConfig;

    onRun?: (nodeId: string) => void;
    onEdit?: (nodeId: string) => void;
    onDelete?: (nodeId: string) => void;
};

export type NotebookNode = Node<NotebookBlockData>;

export type NotebookBlockRequest = {
    requestId: number;
    blockType: NotebookBlockType;
};

export type NotebookAutoLayoutMode = 'arrange' | 'connect' | 'arrange-connect';

export type NotebookAutoLayoutRequest = {
    requestId: number;
    mode: NotebookAutoLayoutMode;
};

export type NotebookZoomValue = 'auto' | '75' | '100' | '125' | '150';

export type NotebookViewportRequest =
    | {
    requestId: number;
    mode: 'fit';
}
    | {
    requestId: number;
    mode: 'zoom';
    zoom: number;
};

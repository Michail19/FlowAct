import type { Node } from '@xyflow/react';

export type NotebookBlockType =
    | 'start'
    | 'end'
    | 'ai'
    | 'condition'
    | 'action'
    | 'database'
    | 'email'
    | 'log';

export type NotebookBlockStatus = 'idle' | 'running' | 'success' | 'error';

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
    actionType: 'format' | 'transform' | 'httpRequest' | 'custom';
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

export type NotebookBlockConfig = {
    condition?: ConditionBlockConfig;
    action?: ActionBlockConfig;
    database?: DatabaseBlockConfig;
    email?: EmailBlockConfig;
    log?: LogBlockConfig;
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

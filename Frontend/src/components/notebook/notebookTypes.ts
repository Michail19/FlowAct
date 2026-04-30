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

export type NotebookBlockData = {
    title: string;
    subtitle?: string;
    description?: string;
    blockType: NotebookBlockType;
    status?: NotebookBlockStatus;
    icon?: string;
    meta?: string;
    aiConfig?: AiBlockConfig;

    onRun?: (nodeId: string) => void;
    onEdit?: (nodeId: string) => void;
    onDelete?: (nodeId: string) => void;
};

export type NotebookNode = Node<NotebookBlockData>;

export type NotebookBlockRequest = {
    requestId: number;
    blockType: NotebookBlockType;
};

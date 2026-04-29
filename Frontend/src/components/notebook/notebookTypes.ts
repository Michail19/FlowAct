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
    blockType: NotebookBlockType;
    status?: NotebookBlockStatus;
    icon?: string;
    meta?: string;
    aiConfig?: AiBlockConfig;
};

export type NotebookNode = Node<NotebookBlockData>;

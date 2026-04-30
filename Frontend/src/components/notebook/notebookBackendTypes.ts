import type { Viewport } from '@xyflow/react';

import type { NotebookBlockType } from './notebookTypes';

export type NotebookBlockPositionDto = {
    x: number;
    y: number;
};

export type NotebookAiConfigDto = {
    prompt: string;
    models: string[];
};

export type NotebookBlockConfigDto = {
    ai?: NotebookAiConfigDto;
};

export type NotebookBlockDto = {
    id: string;
    type: NotebookBlockType;
    title: string;
    subtitle?: string;
    description?: string;
    position: NotebookBlockPositionDto;
    config?: NotebookBlockConfigDto;
};

export type NotebookConnectionDto = {
    id: string;
    sourceBlockId: string;
    targetBlockId: string;
    label?: string;
};

export type NotebookPayloadDto = {
    id?: string;
    title: string;
    version: number;
    blocks: NotebookBlockDto[];
    connections: NotebookConnectionDto[];
    viewport?: Viewport;
    updatedAt: string;
};

import type { Viewport } from '@xyflow/react';

import type {
    ActionBlockConfig,
    AiBlockConfig,
    ConditionBlockConfig,
    DatabaseBlockConfig,
    EmailBlockConfig,
    HttpBlockConfig,
    LogBlockConfig,
    LoopBlockConfig,
    MergeBlockConfig,
    NotebookBlockType,
} from './notebookTypes';

export type NotebookBlockPositionDto = {
    x: number;
    y: number;
};

export type NotebookAiConfigDto = AiBlockConfig;

export type NotebookConditionConfigDto = ConditionBlockConfig;

export type NotebookActionConfigDto = ActionBlockConfig;

export type NotebookDatabaseConfigDto = DatabaseBlockConfig;

export type NotebookEmailConfigDto = EmailBlockConfig;

export type NotebookLogConfigDto = LogBlockConfig;

export type NotebookHttpConfigDto = HttpBlockConfig;

export type NotebookLoopConfigDto = LoopBlockConfig;

export type NotebookMergeConfigDto = MergeBlockConfig;

export type NotebookBlockConfigDto = {
    ai?: NotebookAiConfigDto;
    condition?: NotebookConditionConfigDto;
    action?: NotebookActionConfigDto;
    database?: NotebookDatabaseConfigDto;
    email?: NotebookEmailConfigDto;
    log?: NotebookLogConfigDto;
    http?: NotebookHttpConfigDto;
    loop?: NotebookLoopConfigDto;
    merge?: NotebookMergeConfigDto;
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
    sourceHandle?: string;
    targetHandle?: string;
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

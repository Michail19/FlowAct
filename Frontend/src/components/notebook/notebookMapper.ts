import type { Edge, Viewport } from '@xyflow/react';

import { getBlockDefinition } from './blockLibrary';
import type {
    NotebookBlockData,
    NotebookNode,
} from './notebookTypes';
import type {
    NotebookBlockDto,
    NotebookConnectionDto,
    NotebookPayloadDto,
} from './notebookBackendTypes';

function getNodeTypeByBlockType(blockType: NotebookBlockData['blockType']) {
    return blockType === 'ai' ? 'aiBlock' : 'customBlock';
}

export function toNotebookPayload(params: {
    notebookId?: string;
    title: string;
    nodes: NotebookNode[];
    edges: Edge[];
    viewport?: Viewport;
}): NotebookPayloadDto {
    const blocks: NotebookBlockDto[] = params.nodes.map((node) => {
        const block: NotebookBlockDto = {
            id: node.id,
            type: node.data.blockType,
            title: node.data.title,
            subtitle: node.data.subtitle,
            description: node.data.description,
            position: {
                x: node.position.x,
                y: node.position.y,
            },
        };

        const config: NotebookBlockDto['config'] = {};

        if (node.data.blockType === 'ai' && node.data.aiConfig) {
            config.ai = {
                prompt: node.data.aiConfig.prompt,
                models: node.data.aiConfig.models,
            };
        }

        if (node.data.config?.condition) {
            config.condition = node.data.config.condition;
        }

        if (node.data.config?.action) {
            config.action = node.data.config.action;
        }

        if (node.data.config?.database) {
            config.database = node.data.config.database;
        }

        if (node.data.config?.email) {
            config.email = node.data.config.email;
        }

        if (node.data.config?.log) {
            config.log = node.data.config.log;
        }

        if (node.data.config?.http) {
            config.http = node.data.config.http;
        }

        if (node.data.config?.loop) {
            config.loop = node.data.config.loop;
        }

        if (node.data.config?.merge) {
            config.merge = node.data.config.merge;
        }

        if (Object.keys(config).length > 0) {
            block.config = config;
        }

        return block;
    });

    const connections: NotebookConnectionDto[] = params.edges.map((edge) => ({
        id: edge.id,
        sourceBlockId: edge.source,
        targetBlockId: edge.target,
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,
        label: typeof edge.label === 'string' ? edge.label : undefined,
    }));

    return {
        id: params.notebookId,
        title: params.title,
        version: 1,
        blocks,
        connections,
        viewport: params.viewport,
        updatedAt: new Date().toISOString(),
    };
}

function getConditionSourceHandleFromLabel(label?: string): string | undefined {
    if (label === 'Да') {
        return 'yes';
    }

    if (label === 'Нет') {
        return 'no';
    }

    return undefined;
}

export function fromNotebookPayload(payload: NotebookPayloadDto): {
    nodes: NotebookNode[];
    edges: Edge[];
} {
    const nodes: NotebookNode[] = payload.blocks.map((block) => {
        const definition = getBlockDefinition(block.type);

        return {
            id: block.id,
            type: getNodeTypeByBlockType(block.type),
            position: block.position,
            data: {
                title: block.title,
                subtitle: block.subtitle ?? definition.subtitle,
                description: block.description ?? definition.description,
                icon: definition.icon,
                blockType: block.type,
                status: 'idle',
                aiConfig: block.config?.ai,
                config: block.config,
            },
        };
    });

    const blockTypeById = new Map(
        payload.blocks.map((block) => [block.id, block.type]),
    );

    const edges: Edge[] = payload.connections.map((connection) => {
        const isConditionSource = blockTypeById.get(connection.sourceBlockId) === 'condition';

        return {
            id: connection.id,
            source: connection.sourceBlockId,
            target: connection.targetBlockId,
            sourceHandle:
                connection.sourceHandle ??
                (isConditionSource
                    ? getConditionSourceHandleFromLabel(connection.label)
                    : undefined),
            targetHandle: connection.targetHandle,
            type: 'smoothstep',
            label: connection.label,
        };
    });

    return {
        nodes,
        edges,
    };
}

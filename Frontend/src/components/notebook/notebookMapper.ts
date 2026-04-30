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

        if (node.data.blockType === 'ai' && node.data.aiConfig) {
            block.config = {
                ai: {
                    prompt: node.data.aiConfig.prompt,
                    models: node.data.aiConfig.models,
                },
            };
        }

        return block;
    });

    const connections: NotebookConnectionDto[] = params.edges.map((edge) => ({
        id: edge.id,
        sourceBlockId: edge.source,
        targetBlockId: edge.target,
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
            },
        };
    });

    const edges: Edge[] = payload.connections.map((connection) => ({
        id: connection.id,
        source: connection.sourceBlockId,
        target: connection.targetBlockId,
        type: 'smoothstep',
        label: connection.label,
    }));

    return {
        nodes,
        edges,
    };
}

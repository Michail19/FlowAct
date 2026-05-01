import type { Edge } from '@xyflow/react';

import type {
    NotebookExecutionLog,
    WorkflowExecutionStatus,
} from './executionTypes';
import type { NotebookNode } from './notebookTypes';

export function sleep(ms: number) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

export function createExecutionLog(params: {
    level: NotebookExecutionLog['level'];
    status: WorkflowExecutionStatus;
    message: string;
    blockId?: string;
    blockTitle?: string;
}): NotebookExecutionLog {
    return {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        level: params.level,
        status: params.status,
        message: params.message,
        blockId: params.blockId,
        blockTitle: params.blockTitle,
        createdAt: new Date().toISOString(),
    };
}

export function getWorkflowExecutionOrder(nodes: NotebookNode[], edges: Edge[]): NotebookNode[] {
    if (nodes.length === 0) {
        return [];
    }

    const nodeMap = new Map(nodes.map((node) => [node.id, node]));

    const outgoingEdges = edges.reduce<Map<string, Edge[]>>((map, edge) => {
        const list = map.get(edge.source) ?? [];
        list.push(edge);
        map.set(edge.source, list);
        return map;
    }, new Map());

    const startNode =
        nodes.find((node) => node.data.blockType === 'start') ??
        [...nodes].sort((firstNode, secondNode) => firstNode.position.x - secondNode.position.x)[0];

    const visitedNodeIds = new Set<string>();
    const orderedNodes: NotebookNode[] = [];

    const visit = (nodeId: string) => {
        if (visitedNodeIds.has(nodeId)) {
            return;
        }

        const node = nodeMap.get(nodeId);

        if (!node) {
            return;
        }

        visitedNodeIds.add(nodeId);
        orderedNodes.push(node);

        const nextEdges = [...(outgoingEdges.get(nodeId) ?? [])].sort((firstEdge, secondEdge) => {
            const firstLabel = typeof firstEdge.label === 'string' ? firstEdge.label : '';
            const secondLabel = typeof secondEdge.label === 'string' ? secondEdge.label : '';

            return firstLabel.localeCompare(secondLabel);
        });

        nextEdges.forEach((edge) => visit(edge.target));
    };

    visit(startNode.id);

    const disconnectedNodes = nodes
        .filter((node) => !visitedNodeIds.has(node.id))
        .sort((firstNode, secondNode) => {
            if (firstNode.position.x !== secondNode.position.x) {
                return firstNode.position.x - secondNode.position.x;
            }

            return firstNode.position.y - secondNode.position.y;
        });

    return [...orderedNodes, ...disconnectedNodes];
}

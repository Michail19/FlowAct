import type { Edge } from '@xyflow/react';

import type { NotebookAutoLayoutMode, NotebookNode } from './notebookTypes';

const START_X = 80;
const START_Y = 120;
const HORIZONTAL_GAP = 120;
const VERTICAL_GAP = 250;
const MAX_NODES_IN_ROW = 4;

function getBlockPriority(node: NotebookNode): number {
    if (node.data.blockType === 'start') {
        return 0;
    }

    if (node.data.blockType === 'end') {
        return 2;
    }

    return 1;
}

function getNodeWidth(node: NotebookNode): number {
    return node.data.blockType === 'ai' ? 380 : 290;
}

function sortNodesForAutoLayout(nodes: NotebookNode[]): NotebookNode[] {
    return [...nodes].sort((firstNode, secondNode) => {
        const priorityDifference = getBlockPriority(firstNode) - getBlockPriority(secondNode);

        if (priorityDifference !== 0) {
            return priorityDifference;
        }

        if (firstNode.position.x !== secondNode.position.x) {
            return firstNode.position.x - secondNode.position.x;
        }

        if (firstNode.position.y !== secondNode.position.y) {
            return firstNode.position.y - secondNode.position.y;
        }

        return firstNode.id.localeCompare(secondNode.id);
    });
}

function arrangeNodes(nodes: NotebookNode[]): NotebookNode[] {
    const orderedNodes = sortNodesForAutoLayout(nodes);

    let currentX = START_X;
    let currentY = START_Y;
    let nodesInCurrentRow = 0;

    return orderedNodes.map((node) => {
        const arrangedNode: NotebookNode = {
            ...node,
            position: {
                x: currentX,
                y: currentY,
            },
        };

        nodesInCurrentRow += 1;

        if (nodesInCurrentRow >= MAX_NODES_IN_ROW) {
            nodesInCurrentRow = 0;
            currentX = START_X;
            currentY += VERTICAL_GAP;
        } else {
            currentX += getNodeWidth(node) + HORIZONTAL_GAP;
        }

        return arrangedNode;
    });
}

function hasEdgeBetween(edges: Edge[], source: string, target: string): boolean {
    return edges.some((edge) => edge.source === source && edge.target === target);
}

function hasOutgoingEdge(edges: Edge[], nodeId: string): boolean {
    return edges.some((edge) => edge.source === nodeId);
}

function hasIncomingEdge(edges: Edge[], nodeId: string): boolean {
    return edges.some((edge) => edge.target === nodeId);
}

function createAutoEdge(source: NotebookNode, target: NotebookNode): Edge {
    return {
        id: `auto-${source.id}-${target.id}`,
        source: source.id,
        target: target.id,
        type: 'smoothstep',
    };
}

function connectNodes(nodes: NotebookNode[], edges: Edge[]): Edge[] {
    const orderedNodes = sortNodesForAutoLayout(nodes);
    const nextEdges = [...edges];

    if (orderedNodes.length < 2) {
        return nextEdges;
    }

    orderedNodes.forEach((node, index) => {
        const nextNode = orderedNodes[index + 1];

        if (!nextNode) {
            return;
        }

        if (node.data.blockType === 'end' || nextNode.data.blockType === 'start') {
            return;
        }

        if (hasEdgeBetween(nextEdges, node.id, nextNode.id)) {
            return;
        }

        const shouldCreateEdge =
            edges.length === 0 ||
            (!hasOutgoingEdge(nextEdges, node.id) && !hasIncomingEdge(nextEdges, nextNode.id));

        if (!shouldCreateEdge) {
            return;
        }

        nextEdges.push(createAutoEdge(node, nextNode));
    });

    return nextEdges;
}

export function autoLayoutWorkflow(params: {
    nodes: NotebookNode[];
    edges: Edge[];
    mode: NotebookAutoLayoutMode;
}): {
    nodes: NotebookNode[];
    edges: Edge[];
    movedNodesCount: number;
    createdEdgesCount: number;
} {
    const shouldArrange = params.mode === 'arrange' || params.mode === 'arrange-connect';
    const shouldConnect = params.mode === 'connect' || params.mode === 'arrange-connect';

    const arrangedNodes = shouldArrange ? arrangeNodes(params.nodes) : params.nodes;
    const connectedEdges = shouldConnect ? connectNodes(arrangedNodes, params.edges) : params.edges;

    return {
        nodes: arrangedNodes,
        edges: connectedEdges,
        movedNodesCount: shouldArrange ? arrangedNodes.length : 0,
        createdEdgesCount: connectedEdges.length - params.edges.length,
    };
}

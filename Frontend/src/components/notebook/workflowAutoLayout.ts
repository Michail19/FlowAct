import type { Edge } from '@xyflow/react';

import type { NotebookAutoLayoutMode, NotebookNode } from './notebookTypes';

const START_X = 80;
const BASE_Y = 210;
const HORIZONTAL_GAP = 120;
const VERTICAL_GAP = 260;

function getNodeWidth(node: NotebookNode): number {
    return node.data.blockType === 'ai' ? 380 : 290;
}

function getBlockPriority(node: NotebookNode): number {
    if (node.data.blockType === 'start') {
        return 0;
    }

    if (node.data.blockType === 'end') {
        return 2;
    }

    return 1;
}

function sortNodesByCanvasPosition(nodes: NotebookNode[]): NotebookNode[] {
    return [...nodes].sort((firstNode, secondNode) => {
        const priorityDifference = getBlockPriority(firstNode) - getBlockPriority(secondNode);

        if (priorityDifference !== 0) {
            return priorityDifference;
        }

        if (firstNode.position.y !== secondNode.position.y) {
            return firstNode.position.y - secondNode.position.y;
        }

        if (firstNode.position.x !== secondNode.position.x) {
            return firstNode.position.x - secondNode.position.x;
        }

        return firstNode.id.localeCompare(secondNode.id);
    });
}

function getValidEdges(nodes: NotebookNode[], edges: Edge[]): Edge[] {
    const nodeIds = new Set(nodes.map((node) => node.id));

    return edges.filter(
        (edge) =>
            nodeIds.has(edge.source) &&
            nodeIds.has(edge.target) &&
            edge.source !== edge.target,
    );
}

function getStartNode(nodes: NotebookNode[]): NotebookNode | undefined {
    return (
        nodes.find((node) => node.data.blockType === 'start') ??
        [...nodes].sort((firstNode, secondNode) => {
            if (firstNode.position.x !== secondNode.position.x) {
                return firstNode.position.x - secondNode.position.x;
            }

            return firstNode.position.y - secondNode.position.y;
        })[0]
    );
}

function getDepthMap(nodes: NotebookNode[], edges: Edge[]): Map<string, number> {
    const depthMap = new Map<string, number>();
    const startNode = getStartNode(nodes);

    if (!startNode) {
        return depthMap;
    }

    depthMap.set(startNode.id, 0);

    for (let iteration = 0; iteration < nodes.length; iteration += 1) {
        edges.forEach((edge) => {
            const sourceDepth = depthMap.get(edge.source);

            if (sourceDepth === undefined) {
                return;
            }

            const nextDepth = sourceDepth + 1;
            const currentTargetDepth = depthMap.get(edge.target);

            if (currentTargetDepth === undefined || nextDepth > currentTargetDepth) {
                depthMap.set(edge.target, nextDepth);
            }
        });
    }

    const maxDepth = Math.max(0, ...Array.from(depthMap.values()));
    const disconnectedNodes = sortNodesByCanvasPosition(
        nodes.filter((node) => !depthMap.has(node.id)),
    );

    disconnectedNodes.forEach((node, index) => {
        depthMap.set(node.id, maxDepth + index + 1);
    });

    return depthMap;
}

function groupNodesByDepth(
    nodes: NotebookNode[],
    depthMap: Map<string, number>,
): Map<number, NotebookNode[]> {
    const layers = new Map<number, NotebookNode[]>();

    nodes.forEach((node) => {
        const depth = depthMap.get(node.id) ?? 0;
        const layer = layers.get(depth) ?? [];

        layer.push(node);
        layers.set(depth, layer);
    });

    layers.forEach((layer, depth) => {
        layers.set(depth, sortNodesByCanvasPosition(layer));
    });

    return layers;
}

function arrangeNodesByGraph(nodes: NotebookNode[], edges: Edge[]): NotebookNode[] {
    if (nodes.length === 0) {
        return [];
    }

    const validEdges = getValidEdges(nodes, edges);

    if (validEdges.length === 0) {
        return arrangeNodesSequentially(nodes);
    }

    const depthMap = getDepthMap(nodes, validEdges);
    const layers = groupNodesByDepth(nodes, depthMap);
    const sortedDepths = Array.from(layers.keys()).sort((firstDepth, secondDepth) => firstDepth - secondDepth);

    let currentX = START_X;
    const arrangedNodes: NotebookNode[] = [];

    sortedDepths.forEach((depth) => {
        const layer = layers.get(depth) ?? [];
        const layerMaxWidth = Math.max(...layer.map(getNodeWidth));
        const totalLayerHeight = (layer.length - 1) * VERTICAL_GAP;
        const firstY = BASE_Y - totalLayerHeight / 2;

        layer.forEach((node, index) => {
            arrangedNodes.push({
                ...node,
                position: {
                    x: Math.round(currentX),
                    y: Math.round(firstY + index * VERTICAL_GAP),
                },
            });
        });

        currentX += layerMaxWidth + HORIZONTAL_GAP;
    });

    return arrangedNodes;
}

function arrangeNodesSequentially(nodes: NotebookNode[]): NotebookNode[] {
    const orderedNodes = sortNodesByCanvasPosition(nodes);

    let currentX = START_X;

    return orderedNodes.map((node) => {
        const arrangedNode: NotebookNode = {
            ...node,
            position: {
                x: currentX,
                y: BASE_Y,
            },
        };

        currentX += getNodeWidth(node) + HORIZONTAL_GAP;

        return arrangedNode;
    });
}

function removeOldAutoEdges(edges: Edge[]): Edge[] {
    return edges.filter((edge) => !edge.id.startsWith('auto-'));
}

function hasEdgeBetween(edges: Edge[], source: string, target: string): boolean {
    return edges.some((edge) => edge.source === source && edge.target === target);
}

function createAutoEdge(source: NotebookNode, target: NotebookNode): Edge {
    return {
        id: `auto-${source.id}-${target.id}`,
        source: source.id,
        target: target.id,
        type: 'smoothstep',
    };
}

function connectNodesSafely(nodes: NotebookNode[], edges: Edge[]): Edge[] {
    const baseEdges = removeOldAutoEdges(edges);

    if (baseEdges.length > 0) {
        return baseEdges;
    }

    const orderedNodes = sortNodesByCanvasPosition(nodes);

    if (orderedNodes.length < 2) {
        return baseEdges;
    }

    const nextEdges = [...baseEdges];

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

    const baseEdges = shouldConnect ? removeOldAutoEdges(params.edges) : params.edges;

    const arrangedNodes = shouldArrange
        ? arrangeNodesByGraph(params.nodes, baseEdges)
        : params.nodes;

    const connectedEdges = shouldConnect
        ? connectNodesSafely(arrangedNodes, baseEdges)
        : baseEdges;

    return {
        nodes: arrangedNodes,
        edges: connectedEdges,
        movedNodesCount: shouldArrange ? arrangedNodes.length : 0,
        createdEdgesCount: Math.max(0, connectedEdges.length - baseEdges.length),
    };
}

import type { Edge } from '@xyflow/react';

import { getBlockDefinition } from './blockLibrary';
import type { NotebookAutoLayoutMode, NotebookNode } from './notebookTypes';
import {
    conditionBranchLabels,
    getAvailableConditionBranchForEdges,
    getUsedConditionBranches,
    type ConditionBranch,
} from './conditionBranchUtils';

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

        if (firstNode.position.x !== secondNode.position.x) {
            return firstNode.position.x - secondNode.position.x;
        }

        if (firstNode.position.y !== secondNode.position.y) {
            return firstNode.position.y - secondNode.position.y;
        }

        return firstNode.id.localeCompare(secondNode.id);
    });
}

function sortContentNodesByCanvasPosition(nodes: NotebookNode[]): NotebookNode[] {
    return [...nodes]
        .filter((node) => node.data.blockType !== 'start' && node.data.blockType !== 'end')
        .sort((firstNode, secondNode) => {
            if (firstNode.position.x !== secondNode.position.x) {
                return firstNode.position.x - secondNode.position.x;
            }

            if (firstNode.position.y !== secondNode.position.y) {
                return firstNode.position.y - secondNode.position.y;
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

function removeOldAutoEdges(edges: Edge[]): Edge[] {
    return edges.filter((edge) => !edge.id.startsWith('auto-'));
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

function canCreateOutgoingEdge(source: NotebookNode, edges: Edge[]): boolean {
    if (source.data.blockType === 'end') {
        return false;
    }

    if (source.data.blockType === 'condition') {
        return getAvailableConditionBranchForEdges(source.id, edges) !== null;
    }

    return !hasOutgoingEdge(edges, source.id);
}

function getPreferredConditionBranchForTarget(
    source: NotebookNode,
    target: NotebookNode,
    edges: Edge[],
): ConditionBranch | null {
    if (source.data.blockType !== 'condition') {
        return null;
    }

    const usedBranches = getUsedConditionBranches(source.id, edges);
    const availableBranch = getAvailableConditionBranchForEdges(source.id, edges);

    const targetIsAbove = target.position.y < source.position.y;
    const targetIsBelow = target.position.y > source.position.y;

    if (targetIsAbove && !usedBranches.has('yes')) {
        return 'yes';
    }

    if (targetIsBelow && !usedBranches.has('no')) {
        return 'no';
    }

    return availableBranch;
}

function createAutoEdge(
    source: NotebookNode,
    target: NotebookNode,
    edges: Edge[],
    conditionBranch?: ConditionBranch,
): Edge | null {
    if (source.data.blockType === 'condition') {
        const branch =
            conditionBranch ??
            getPreferredConditionBranchForTarget(source, target, edges);

        if (!branch) {
            return null;
        }

        return {
            id: `auto-${source.id}-${branch}-${target.id}`,
            source: source.id,
            sourceHandle: branch,
            target: target.id,
            type: 'smoothstep',
            label: conditionBranchLabels[branch],
        };
    }

    return {
        id: `auto-${source.id}-${target.id}`,
        source: source.id,
        target: target.id,
        type: 'smoothstep',
    };
}

function createUniqueNodeId(baseId: string, nodes: NotebookNode[]): string {
    const existingNodeIds = new Set(nodes.map((node) => node.id));

    if (!existingNodeIds.has(baseId)) {
        return baseId;
    }

    let index = 1;

    while (existingNodeIds.has(`${baseId}-${index}`)) {
        index += 1;
    }

    return `${baseId}-${index}`;
}

function createBoundaryNode(params: {
    blockType: 'start' | 'end';
    nodes: NotebookNode[];
    position: { x: number; y: number };
}): NotebookNode {
    const definition = getBlockDefinition(params.blockType);
    const id = createUniqueNodeId(`auto-${params.blockType}`, params.nodes);

    return {
        id,
        type: 'customBlock',
        position: params.position,
        data: {
            title: definition.title,
            subtitle: definition.subtitle,
            description: definition.description,
            icon: definition.icon,
            blockType: params.blockType,
            status: 'idle',
        },
    };
}

function createAutoMergeNode(params: {
    nodes: NotebookNode[];
    endNode: NotebookNode;
    sourceNodes: NotebookNode[];
}): NotebookNode {
    const definition = getBlockDefinition('merge');
    const id = createUniqueNodeId('auto-merge', params.nodes);

    const averageY =
        params.sourceNodes.length > 0
            ? Math.round(
                params.sourceNodes.reduce(
                    (sum, node) => sum + node.position.y,
                    0,
                ) / params.sourceNodes.length,
            )
            : params.endNode.position.y;

    return {
        id,
        type: 'customBlock',
        position: {
            x: params.endNode.position.x - 420,
            y: averageY,
        },
        data: {
            title: definition.title,
            subtitle: definition.subtitle,
            description: definition.description,
            icon: definition.icon,
            blockType: 'merge',
            status: 'idle',
            config: {
                merge: {
                    mode: 'combine',
                },
            },
        },
    };
}

function ensureBoundaryNodes(nodes: NotebookNode[]): {
    nodes: NotebookNode[];
    createdNodesCount: number;
} {
    const nextNodes = [...nodes];
    const contentNodes = sortContentNodesByCanvasPosition(nextNodes);

    const hasStartNode = nextNodes.some((node) => node.data.blockType === 'start');
    const hasEndNode = nextNodes.some((node) => node.data.blockType === 'end');

    let createdNodesCount = 0;

    if (!hasStartNode) {
        const firstContentNode = contentNodes[0];

        nextNodes.push(
            createBoundaryNode({
                blockType: 'start',
                nodes: nextNodes,
                position: {
                    x: firstContentNode ? firstContentNode.position.x - 420 : START_X,
                    y: firstContentNode ? firstContentNode.position.y : BASE_Y,
                },
            }),
        );

        createdNodesCount += 1;
    }

    if (!hasEndNode) {
        const lastContentNode = contentNodes[contentNodes.length - 1];

        nextNodes.push(
            createBoundaryNode({
                blockType: 'end',
                nodes: nextNodes,
                position: {
                    x: lastContentNode ? lastContentNode.position.x + 420 : START_X + 420,
                    y: lastContentNode ? lastContentNode.position.y : BASE_Y,
                },
            }),
        );

        createdNodesCount += 1;
    }

    return {
        nodes: nextNodes,
        createdNodesCount,
    };
}

function wouldCreateCycle(sourceId: string, targetId: string, edges: Edge[]): boolean {
    const stack = [targetId];
    const visitedNodeIds = new Set<string>();

    while (stack.length > 0) {
        const currentNodeId = stack.pop();

        if (!currentNodeId || visitedNodeIds.has(currentNodeId)) {
            continue;
        }

        if (currentNodeId === sourceId) {
            return true;
        }

        visitedNodeIds.add(currentNodeId);

        edges
            .filter((edge) => edge.source === currentNodeId)
            .forEach((edge) => {
                stack.push(edge.target);
            });
    }

    return false;
}

function getDistanceBetweenNodes(source: NotebookNode, target: NotebookNode): number {
    const dx = target.position.x - source.position.x;
    const dy = target.position.y - source.position.y;

    const leftToRightBonus = dx >= 0 ? -500 : 500;

    return Math.abs(dx) + Math.abs(dy) + leftToRightBonus;
}

function findBestTargetForSource(
    source: NotebookNode,
    targetCandidates: NotebookNode[],
    edges: Edge[],
): NotebookNode | undefined {
    return [...targetCandidates]
        .filter((target) => target.id !== source.id)
        .filter((target) => target.data.blockType !== 'start')
        .filter((target) => !hasEdgeBetween(edges, source.id, target.id))
        .filter((target) => !wouldCreateCycle(source.id, target.id, edges))
        .sort((firstTarget, secondTarget) => {
            const firstDistance = getDistanceBetweenNodes(source, firstTarget);
            const secondDistance = getDistanceBetweenNodes(source, secondTarget);

            if (firstDistance !== secondDistance) {
                return firstDistance - secondDistance;
            }

            return firstTarget.id.localeCompare(secondTarget.id);
        })[0];
}

function findNearestTargetForConditionBranch(
    source: NotebookNode,
    branch: ConditionBranch,
    targetCandidates: NotebookNode[],
    edges: Edge[],
): NotebookNode | undefined {
    return [...targetCandidates]
        .filter((target) => target.id !== source.id)
        .filter((target) => target.data.blockType !== 'start')
        .filter((target) => !hasIncomingEdge(edges, target.id))
        .filter((target) => !hasEdgeBetween(edges, source.id, target.id))
        .filter((target) => !wouldCreateCycle(source.id, target.id, edges))
        .filter((target) =>
            branch === 'yes'
                ? target.position.y < source.position.y
                : target.position.y > source.position.y,
        )
        .sort((firstTarget, secondTarget) => {
            const firstDistance = getDistanceBetweenNodes(source, firstTarget);
            const secondDistance = getDistanceBetweenNodes(source, secondTarget);

            if (firstDistance !== secondDistance) {
                return firstDistance - secondDistance;
            }

            return firstTarget.id.localeCompare(secondTarget.id);
        })[0];
}

function connectConditionBranchesToNearbyNodes(
    nodes: NotebookNode[],
    edges: Edge[],
): Edge[] {
    const nextEdges = [...edges];

    const conditionNodes = sortNodesByCanvasPosition(nodes).filter(
        (node) => node.data.blockType === 'condition',
    );

    conditionNodes.forEach((conditionNode) => {
        const usedBranches = getUsedConditionBranches(conditionNode.id, nextEdges);

        const targetCandidates = sortContentNodesByCanvasPosition(nodes).filter(
            (node) => node.id !== conditionNode.id,
        );

        if (!usedBranches.has('yes')) {
            const yesTarget = findNearestTargetForConditionBranch(
                conditionNode,
                'yes',
                targetCandidates,
                nextEdges,
            );

            if (yesTarget) {
                const edge = createAutoEdge(conditionNode, yesTarget, nextEdges, 'yes');

                if (edge) {
                    nextEdges.push(edge);
                }
            }
        }

        if (!usedBranches.has('no')) {
            const noTarget = findNearestTargetForConditionBranch(
                conditionNode,
                'no',
                targetCandidates,
                nextEdges,
            );

            if (noTarget) {
                const edge = createAutoEdge(conditionNode, noTarget, nextEdges, 'no');

                if (edge) {
                    nextEdges.push(edge);
                }
            }
        }
    });

    return nextEdges;
}

function connectStartToFirstFreeNode(nodes: NotebookNode[], edges: Edge[]): Edge[] {
    const nextEdges = [...edges];

    const startNode = sortNodesByCanvasPosition(
        nodes.filter((node) => node.data.blockType === 'start'),
    )[0];

    if (!startNode || hasOutgoingEdge(nextEdges, startNode.id)) {
        return nextEdges;
    }

    const target = sortContentNodesByCanvasPosition(nodes).find(
        (node) => !hasIncomingEdge(nextEdges, node.id),
    );

    if (!target || wouldCreateCycle(startNode.id, target.id, nextEdges)) {
        return nextEdges;
    }

    const edge = createAutoEdge(startNode, target, nextEdges);

    if (edge) {
        nextEdges.push(edge);
    }

    return nextEdges;
}

function connectComponents(nodes: NotebookNode[], edges: Edge[]): Edge[] {
    const nextEdges = [...edges];

    const sourceCandidates = sortNodesByCanvasPosition(nodes).filter((node) =>
        canCreateOutgoingEdge(node, nextEdges),
    );

    const targetCandidates = sortContentNodesByCanvasPosition(nodes).filter(
        (node) => !hasIncomingEdge(nextEdges, node.id),
    );

    sourceCandidates.forEach((source) => {
        const availableTargets = targetCandidates.filter(
            (target) => !hasIncomingEdge(nextEdges, target.id),
        );

        const target = findBestTargetForSource(source, availableTargets, nextEdges);

        if (!target) {
            return;
        }

        const edge = createAutoEdge(source, target, nextEdges);

        if (edge) {
            nextEdges.push(edge);
        }
    });

    return nextEdges;
}

function findMergeNodeBeforeEnd(
    nodes: NotebookNode[],
    edges: Edge[],
    endNodeId: string,
): NotebookNode | undefined {
    return sortNodesByCanvasPosition(nodes).find(
        (node) =>
            node.data.blockType === 'merge' &&
            (hasEdgeBetween(edges, node.id, endNodeId) ||
                !hasOutgoingEdge(edges, node.id)),
    );
}

function connectSingleNodeToEnd(
    node: NotebookNode,
    endNode: NotebookNode,
    edges: Edge[],
): Edge[] {
    const nextEdges = [...edges];

    if (hasEdgeBetween(nextEdges, node.id, endNode.id)) {
        return nextEdges;
    }

    if (wouldCreateCycle(node.id, endNode.id, nextEdges)) {
        return nextEdges;
    }

    const edge = createAutoEdge(node, endNode, nextEdges);

    if (edge) {
        nextEdges.push(edge);
    }

    return nextEdges;
}

function connectDanglingNodesToEnd(params: {
    nodes: NotebookNode[];
    edges: Edge[];
}): {
    nodes: NotebookNode[];
    edges: Edge[];
    createdNodesCount: number;
} {
    const nextNodes = [...params.nodes];
    const nextEdges = [...params.edges];
    let createdNodesCount = 0;

    const endNode = sortNodesByCanvasPosition(
        nextNodes.filter((node) => node.data.blockType === 'end'),
    )[0];

    if (!endNode) {
        return {
            nodes: nextNodes,
            edges: nextEdges,
            createdNodesCount,
        };
    }

    const danglingNodes = sortNodesByCanvasPosition(nextNodes).filter(
        (node) =>
            node.id !== endNode.id &&
            node.data.blockType !== 'end' &&
            canCreateOutgoingEdge(node, nextEdges),
    );

    if (danglingNodes.length === 0) {
        return {
            nodes: nextNodes,
            edges: nextEdges,
            createdNodesCount,
        };
    }

    if (danglingNodes.length === 1) {
        return {
            nodes: nextNodes,
            edges: connectSingleNodeToEnd(danglingNodes[0], endNode, nextEdges),
            createdNodesCount,
        };
    }

    let mergeNode = findMergeNodeBeforeEnd(nextNodes, nextEdges, endNode.id);

    if (!mergeNode) {
        mergeNode = createAutoMergeNode({
            nodes: nextNodes,
            endNode,
            sourceNodes: danglingNodes,
        });

        nextNodes.push(mergeNode);
        createdNodesCount += 1;
    }

    if (!hasOutgoingEdge(nextEdges, mergeNode.id)) {
        const mergeToEndEdge = createAutoEdge(mergeNode, endNode, nextEdges);

        if (mergeToEndEdge && !wouldCreateCycle(mergeNode.id, endNode.id, nextEdges)) {
            nextEdges.push(mergeToEndEdge);
        }
    }

    danglingNodes
        .filter((node) => node.id !== mergeNode.id)
        .forEach((node) => {
            if (hasEdgeBetween(nextEdges, node.id, mergeNode.id)) {
                return;
            }

            if (wouldCreateCycle(node.id, mergeNode.id, nextEdges)) {
                return;
            }

            const edge = createAutoEdge(node, mergeNode, nextEdges);

            if (edge) {
                nextEdges.push(edge);
            }
        });

    return {
        nodes: nextNodes,
        edges: nextEdges,
        createdNodesCount,
    };
}

function connectMissingEdges(nodes: NotebookNode[], edges: Edge[]): {
    nodes: NotebookNode[];
    edges: Edge[];
    createdNodesCount: number;
} {
    const validEdges = getValidEdges(nodes, edges);

    let nextNodes = [...nodes];
    let nextEdges = [...validEdges];

    if (nodes.length < 2) {
        return {
            nodes: nextNodes,
            edges: nextEdges,
            createdNodesCount: 0,
        };
    }

    nextEdges = connectStartToFirstFreeNode(nextNodes, nextEdges);
    nextEdges = connectConditionBranchesToNearbyNodes(nextNodes, nextEdges);
    nextEdges = connectComponents(nextNodes, nextEdges);

    const danglingResult = connectDanglingNodesToEnd({
        nodes: nextNodes,
        edges: nextEdges,
    });

    nextNodes = danglingResult.nodes;
    nextEdges = danglingResult.edges;

    return {
        nodes: nextNodes,
        edges: nextEdges,
        createdNodesCount: danglingResult.createdNodesCount,
    };
}

function getRootNodes(nodes: NotebookNode[], edges: Edge[]): NotebookNode[] {
    const startNodes = nodes.filter((node) => node.data.blockType === 'start');

    const nodesWithoutIncomingEdges = nodes.filter(
        (node) =>
            node.data.blockType !== 'start' &&
            !hasIncomingEdge(edges, node.id),
    );

    return [
        ...sortNodesByCanvasPosition(startNodes),
        ...sortNodesByCanvasPosition(nodesWithoutIncomingEdges),
    ];
}

function getDepthMap(nodes: NotebookNode[], edges: Edge[]): Map<string, number> {
    const depthMap = new Map<string, number>();
    const roots = getRootNodes(nodes, edges);

    roots.forEach((root) => {
        depthMap.set(root.id, 0);
    });

    if (roots.length === 0 && nodes.length > 0) {
        const firstNode = sortNodesByCanvasPosition(nodes)[0];
        depthMap.set(firstNode.id, 0);
    }

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

    sortNodesByCanvasPosition(nodes)
        .filter((node) => !depthMap.has(node.id))
        .forEach((node, index) => {
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
    const sortedDepths = Array.from(layers.keys()).sort(
        (firstDepth, secondDepth) => firstDepth - secondDepth,
    );

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

export function autoLayoutWorkflow(params: {
    nodes: NotebookNode[];
    edges: Edge[];
    mode: NotebookAutoLayoutMode;
}): {
    nodes: NotebookNode[];
    edges: Edge[];
    movedNodesCount: number;
    createdEdgesCount: number;
    createdNodesCount: number;
} {
    const shouldArrange = params.mode === 'arrange' || params.mode === 'arrange-connect';
    const shouldConnect = params.mode === 'connect' || params.mode === 'arrange-connect';

    const boundaryResult = shouldConnect
        ? ensureBoundaryNodes(params.nodes)
        : {
            nodes: params.nodes,
            createdNodesCount: 0,
        };

    const baseEdges = shouldConnect ? removeOldAutoEdges(params.edges) : params.edges;

    const connectionResult = shouldConnect
        ? connectMissingEdges(boundaryResult.nodes, baseEdges)
        : {
            nodes: boundaryResult.nodes,
            edges: baseEdges,
            createdNodesCount: 0,
        };

    const arrangedNodes = shouldArrange
        ? arrangeNodesByGraph(connectionResult.nodes, connectionResult.edges)
        : connectionResult.nodes;

    return {
        nodes: arrangedNodes,
        edges: connectionResult.edges,
        movedNodesCount: shouldArrange ? arrangedNodes.length : 0,
        createdEdgesCount: Math.max(0, connectionResult.edges.length - baseEdges.length),
        createdNodesCount:
            boundaryResult.createdNodesCount + connectionResult.createdNodesCount,
    };
}

import type { Edge } from '@xyflow/react';

import type {
    NotebookExecutionLog,
    WorkflowExecutionStatus,
} from './executionTypes';
import type {
    ConditionBlockConfig,
    NotebookNode,
} from './notebookTypes';
import {
    getConditionBranchFromEdge,
    type ConditionBranch,
} from './conditionBranchUtils';

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

export type WorkflowExecutionPlan = {
    orderedNodes: NotebookNode[];
    skippedNodeIds: Set<string>;
};

function normalizeValue(value: string) {
    return value.trim();
}

function evaluateCondition(config?: ConditionBlockConfig): boolean {
    if (!config) {
        return true;
    }

    const leftValue = normalizeValue(config.leftValue);
    const rightValue = normalizeValue(config.rightValue);

    switch (config.operator) {
        case 'equals':
            return leftValue === rightValue;

        case 'notEquals':
            return leftValue !== rightValue;

        case 'contains':
            return leftValue.includes(rightValue);

        case 'greaterThan':
            return Number(leftValue) > Number(rightValue);

        case 'lessThan':
            return Number(leftValue) < Number(rightValue);

        case 'exists':
            return leftValue.length > 0 && leftValue !== 'null' && leftValue !== 'undefined';

        default:
            return false;
    }
}

function getSelectedConditionBranch(node: NotebookNode): ConditionBranch {
    return evaluateCondition(node.data.config?.condition) ? 'yes' : 'no';
}

function getStartNode(nodes: NotebookNode[]): NotebookNode | undefined {
    return (
        nodes.find((node) => node.data.blockType === 'start') ??
        [...nodes].sort((firstNode, secondNode) => firstNode.position.x - secondNode.position.x)[0]
    );
}

function createOutgoingEdgesMap(edges: Edge[]) {
    return edges.reduce<Map<string, Edge[]>>((map, edge) => {
        const list = map.get(edge.source) ?? [];

        list.push(edge);
        map.set(edge.source, list);

        return map;
    }, new Map());
}

function createIncomingEdgesMap(edges: Edge[]) {
    return edges.reduce<Map<string, Edge[]>>((map, edge) => {
        const list = map.get(edge.target) ?? [];

        list.push(edge);
        map.set(edge.target, list);

        return map;
    }, new Map());
}

function sortEdgesByLabel(edges: Edge[]) {
    return [...edges].sort((firstEdge, secondEdge) => {
        const firstLabel = typeof firstEdge.label === 'string' ? firstEdge.label : '';
        const secondLabel = typeof secondEdge.label === 'string' ? secondEdge.label : '';

        return firstLabel.localeCompare(secondLabel);
    });
}

function isConvergenceNode(
    node: NotebookNode,
    incomingEdgesMap: Map<string, Edge[]>,
): boolean {
    const incomingEdgesCount = incomingEdgesMap.get(node.id)?.length ?? 0;

    return node.data.blockType === 'merge' || incomingEdgesCount > 1;
}

function collectSkippedBranchNodeIds(params: {
    startNodeId: string;
    nodeMap: Map<string, NotebookNode>;
    outgoingEdgesMap: Map<string, Edge[]>;
    incomingEdgesMap: Map<string, Edge[]>;
    alreadyVisitedNodeIds: Set<string>;
}): Set<string> {
    const skippedNodeIds = new Set<string>();
    const stack = [params.startNodeId];

    while (stack.length > 0) {
        const currentNodeId = stack.pop();

        if (
            !currentNodeId ||
            skippedNodeIds.has(currentNodeId) ||
            params.alreadyVisitedNodeIds.has(currentNodeId)
        ) {
            continue;
        }

        const currentNode = params.nodeMap.get(currentNodeId);

        if (!currentNode) {
            continue;
        }

        /*
         * Важно:
         * Merge и любые узлы с несколькими входами — это точки схождения веток.
         * Их нельзя помечать skipped только потому, что одна из веток не выбрана.
         */
        if (isConvergenceNode(currentNode, params.incomingEdgesMap)) {
            continue;
        }

        skippedNodeIds.add(currentNodeId);

        const outgoingEdges = params.outgoingEdgesMap.get(currentNodeId) ?? [];

        outgoingEdges.forEach((edge) => {
            stack.push(edge.target);
        });
    }

    return skippedNodeIds;
}

export function getWorkflowExecutionPlan(nodes: NotebookNode[], edges: Edge[]): WorkflowExecutionPlan {
    if (nodes.length === 0) {
        return {
            orderedNodes: [],
            skippedNodeIds: new Set(),
        };
    }

    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const outgoingEdgesMap = createOutgoingEdgesMap(edges);
    const incomingEdgesMap = createIncomingEdgesMap(edges);
    const startNode = getStartNode(nodes);

    if (!startNode) {
        return {
            orderedNodes: [],
            skippedNodeIds: new Set(),
        };
    }

    const visitedNodeIds = new Set<string>();
    const skippedNodeIds = new Set<string>();
    const orderedNodes: NotebookNode[] = [];

    const visit = (nodeId: string) => {
        /*
         * Если узел раньше попал в skipped, но потом оказался достижим
         * по выбранной ветке, выбранная ветка имеет приоритет.
         */
        skippedNodeIds.delete(nodeId);

        if (visitedNodeIds.has(nodeId)) {
            return;
        }

        const node = nodeMap.get(nodeId);

        if (!node) {
            return;
        }

        visitedNodeIds.add(nodeId);
        orderedNodes.push(node);

        const nodeOutgoingEdges = sortEdgesByLabel(outgoingEdgesMap.get(nodeId) ?? []);

        if (node.data.blockType === 'condition') {
            const selectedBranch = getSelectedConditionBranch(node);

            const selectedEdge = nodeOutgoingEdges.find(
                (edge) => getConditionBranchFromEdge(edge) === selectedBranch,
            );

            const skippedEdges = nodeOutgoingEdges.filter(
                (edge) => getConditionBranchFromEdge(edge) !== selectedBranch,
            );

            skippedEdges.forEach((edge) => {
                const skippedBranchNodeIds = collectSkippedBranchNodeIds({
                    startNodeId: edge.target,
                    nodeMap,
                    outgoingEdgesMap,
                    incomingEdgesMap,
                    alreadyVisitedNodeIds: visitedNodeIds,
                });

                skippedBranchNodeIds.forEach((skippedNodeId) => {
                    skippedNodeIds.add(skippedNodeId);
                });
            });

            if (selectedEdge) {
                visit(selectedEdge.target);
            }

            return;
        }

        nodeOutgoingEdges.forEach((edge) => {
            visit(edge.target);
        });
    };

    visit(startNode.id);

    return {
        orderedNodes,
        skippedNodeIds,
    };
}

export function getWorkflowExecutionOrder(nodes: NotebookNode[], edges: Edge[]): NotebookNode[] {
    return getWorkflowExecutionPlan(nodes, edges).orderedNodes;
}

import type { Edge } from '@xyflow/react';

import type { NotebookNode } from './notebookTypes';

export type WorkflowValidationSeverity = 'error' | 'warning';

export type WorkflowValidationIssue = {
    id: string;
    severity: WorkflowValidationSeverity;
    message: string;
    blockId?: string;
    blockTitle?: string;
};

function createIssue(params: WorkflowValidationIssue): WorkflowValidationIssue {
    return params;
}

function getIncomingEdges(nodeId: string, edges: Edge[]) {
    return edges.filter((edge) => edge.target === nodeId);
}

function getOutgoingEdges(nodeId: string, edges: Edge[]) {
    return edges.filter((edge) => edge.source === nodeId);
}

function getReachableNodeIds(startNodeId: string, edges: Edge[]): Set<string> {
    const reachableNodeIds = new Set<string>();
    const stack = [startNodeId];

    while (stack.length > 0) {
        const currentNodeId = stack.pop();

        if (!currentNodeId || reachableNodeIds.has(currentNodeId)) {
            continue;
        }

        reachableNodeIds.add(currentNodeId);

        edges
            .filter((edge) => edge.source === currentNodeId)
            .forEach((edge) => {
                stack.push(edge.target);
            });
    }

    return reachableNodeIds;
}

function getNodesThatCanReachEnd(endNodeIds: string[], edges: Edge[]): Set<string> {
    const reachableNodeIds = new Set<string>();
    const stack = [...endNodeIds];

    while (stack.length > 0) {
        const currentNodeId = stack.pop();

        if (!currentNodeId || reachableNodeIds.has(currentNodeId)) {
            continue;
        }

        reachableNodeIds.add(currentNodeId);

        edges
            .filter((edge) => edge.target === currentNodeId)
            .forEach((edge) => {
                stack.push(edge.source);
            });
    }

    return reachableNodeIds;
}

function hasCycle(nodes: NotebookNode[], edges: Edge[]): boolean {
    const visitingNodeIds = new Set<string>();
    const visitedNodeIds = new Set<string>();

    const visit = (nodeId: string): boolean => {
        if (visitingNodeIds.has(nodeId)) {
            return true;
        }

        if (visitedNodeIds.has(nodeId)) {
            return false;
        }

        visitingNodeIds.add(nodeId);

        const hasNestedCycle = edges
            .filter((edge) => edge.source === nodeId)
            .some((edge) => visit(edge.target));

        visitingNodeIds.delete(nodeId);
        visitedNodeIds.add(nodeId);

        return hasNestedCycle;
    };

    return nodes.some((node) => visit(node.id));
}

export function validateWorkflow(nodes: NotebookNode[], edges: Edge[]): WorkflowValidationIssue[] {
    const issues: WorkflowValidationIssue[] = [];
    const nodeIds = new Set(nodes.map((node) => node.id));

    if (nodes.length === 0) {
        return [
            createIssue({
                id: 'workflow-empty',
                severity: 'error',
                message: 'В схеме нет блоков. Добавьте хотя бы стартовый и конечный блоки.',
            }),
        ];
    }

    const startNodes = nodes.filter((node) => node.data.blockType === 'start');
    const endNodes = nodes.filter((node) => node.data.blockType === 'end');

    if (startNodes.length === 0) {
        issues.push(
            createIssue({
                id: 'start-missing',
                severity: 'error',
                message: 'В схеме отсутствует стартовый блок.',
            }),
        );
    }

    if (startNodes.length > 1) {
        issues.push(
            createIssue({
                id: 'start-duplicate',
                severity: 'error',
                message: 'В схеме должно быть не больше одного стартового блока.',
            }),
        );
    }

    if (endNodes.length === 0) {
        issues.push(
            createIssue({
                id: 'end-missing',
                severity: 'error',
                message: 'В схеме отсутствует конечный блок.',
            }),
        );
    }

    edges.forEach((edge) => {
        if (!nodeIds.has(edge.source)) {
            issues.push(
                createIssue({
                    id: `edge-${edge.id}-invalid-source`,
                    severity: 'error',
                    message: `Связь "${edge.id}" начинается из несуществующего блока.`,
                }),
            );
        }

        if (!nodeIds.has(edge.target)) {
            issues.push(
                createIssue({
                    id: `edge-${edge.id}-invalid-target`,
                    severity: 'error',
                    message: `Связь "${edge.id}" ведёт в несуществующий блок.`,
                }),
            );
        }

        if (edge.source === edge.target) {
            const node = nodes.find((currentNode) => currentNode.id === edge.source);

            issues.push(
                createIssue({
                    id: `edge-${edge.id}-self-loop`,
                    severity: 'error',
                    blockId: node?.id,
                    blockTitle: node?.data.title,
                    message: `Блок "${node?.data.title ?? edge.source}" не должен быть связан сам с собой.`,
                }),
            );
        }
    });

    const validEdges = edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

    nodes.forEach((node) => {
        const incomingEdges = getIncomingEdges(node.id, validEdges);
        const outgoingEdges = getOutgoingEdges(node.id, validEdges);

        if (node.data.blockType === 'condition') {
            if (outgoingEdges.length > 2) {
                issues.push(
                    createIssue({
                        id: `node-${node.id}-too-many-condition-outputs`,
                        severity: 'error',
                        blockId: node.id,
                        blockTitle: node.data.title,
                        message: `У блока "${node.data.title}" может быть только две исходящие ветки: "Да" и "Нет".`,
                    }),
                );
            }

            const hasYesBranch = outgoingEdges.some((edge) => edge.label === 'Да' || edge.sourceHandle === 'yes');
            const hasNoBranch = outgoingEdges.some((edge) => edge.label === 'Нет' || edge.sourceHandle === 'no');

            if (outgoingEdges.length > 0 && !hasYesBranch) {
                issues.push(
                    createIssue({
                        id: `node-${node.id}-condition-no-yes`,
                        severity: 'warning',
                        blockId: node.id,
                        blockTitle: node.data.title,
                        message: `У блока "${node.data.title}" нет ветки "Да".`,
                    }),
                );
            }

            if (outgoingEdges.length > 1 && !hasNoBranch) {
                issues.push(
                    createIssue({
                        id: `node-${node.id}-condition-no-no`,
                        severity: 'warning',
                        blockId: node.id,
                        blockTitle: node.data.title,
                        message: `У блока "${node.data.title}" нет ветки "Нет".`,
                    }),
                );
            }
        }

        if (node.data.blockType === 'merge') {
            if (incomingEdges.length < 2) {
                issues.push(
                    createIssue({
                        id: `node-${node.id}-merge-not-enough-inputs`,
                        severity: 'error',
                        blockId: node.id,
                        blockTitle: node.data.title,
                        message: `У блока "${node.data.title}" должно быть минимум две входящие связи.`,
                    }),
                );
            }

            if (outgoingEdges.length > 1) {
                issues.push(
                    createIssue({
                        id: `node-${node.id}-merge-too-many-outputs`,
                        severity: 'error',
                        blockId: node.id,
                        blockTitle: node.data.title,
                        message: `У блока "${node.data.title}" должна быть только одна исходящая связь.`,
                    }),
                );
            }
        }

        if (node.data.blockType === 'http' && !node.data.config?.http?.url.trim()) {
            issues.push(
                createIssue({
                    id: `node-${node.id}-http-url-missing`,
                    severity: 'error',
                    blockId: node.id,
                    blockTitle: node.data.title,
                    message: `У блока "${node.data.title}" не задан URL HTTP-запроса.`,
                }),
            );
        }

        if (node.data.blockType === 'loop' && !node.data.config?.loop?.collectionPath.trim()) {
            issues.push(
                createIssue({
                    id: `node-${node.id}-loop-collection-missing`,
                    severity: 'error',
                    blockId: node.id,
                    blockTitle: node.data.title,
                    message: `У блока "${node.data.title}" не задан путь к коллекции.`,
                }),
            );
        }

        if (node.data.blockType !== 'start' && incomingEdges.length === 0) {
            issues.push(
                createIssue({
                    id: `node-${node.id}-no-input`,
                    severity: 'error',
                    blockId: node.id,
                    blockTitle: node.data.title,
                    message: `У блока "${node.data.title}" нет входящей связи.`,
                }),
            );
        }

        if (node.data.blockType !== 'end' && outgoingEdges.length === 0) {
            issues.push(
                createIssue({
                    id: `node-${node.id}-no-output`,
                    severity: 'error',
                    blockId: node.id,
                    blockTitle: node.data.title,
                    message: `У блока "${node.data.title}" нет исходящей связи.`,
                }),
            );
        }
    });

    if (startNodes.length === 1) {
        const reachableNodeIds = getReachableNodeIds(startNodes[0].id, validEdges);

        nodes.forEach((node) => {
            if (!reachableNodeIds.has(node.id)) {
                issues.push(
                    createIssue({
                        id: `node-${node.id}-unreachable`,
                        severity: 'error',
                        blockId: node.id,
                        blockTitle: node.data.title,
                        message: `Блок "${node.data.title}" недостижим от стартового блока.`,
                    }),
                );
            }
        });
    }

    if (endNodes.length > 0) {
        const nodesThatCanReachEnd = getNodesThatCanReachEnd(
            endNodes.map((node) => node.id),
            validEdges,
        );

        nodes.forEach((node) => {
            if (!nodesThatCanReachEnd.has(node.id)) {
                issues.push(
                    createIssue({
                        id: `node-${node.id}-cannot-reach-end`,
                        severity: 'error',
                        blockId: node.id,
                        blockTitle: node.data.title,
                        message: `Из блока "${node.data.title}" нельзя попасть в конечный блок.`,
                    }),
                );
            }
        });
    }

    if (hasCycle(nodes, validEdges)) {
        issues.push(
            createIssue({
                id: 'workflow-cycle',
                severity: 'error',
                message: 'В схеме обнаружен цикл. Для текущего MVP выполнение циклов отключено.',
            }),
        );
    }

    return issues;
}

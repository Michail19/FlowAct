import type { Edge } from '@xyflow/react';

export type ConditionBranch = 'yes' | 'no';

export const conditionBranchLabels: Record<ConditionBranch, string> = {
    yes: 'Да',
    no: 'Нет',
};

export function isConditionBranch(value: string | null | undefined): value is ConditionBranch {
    return value === 'yes' || value === 'no';
}

export function getConditionBranchFromEdge(edge: Edge): ConditionBranch | null {
    if (isConditionBranch(edge.sourceHandle)) {
        return edge.sourceHandle;
    }

    if (edge.label === conditionBranchLabels.yes) {
        return 'yes';
    }

    if (edge.label === conditionBranchLabels.no) {
        return 'no';
    }

    return null;
}

export function getUsedConditionBranches(sourceNodeId: string, edges: Edge[]): Set<ConditionBranch> {
    return new Set(
        edges
            .filter((edge) => edge.source === sourceNodeId)
            .map(getConditionBranchFromEdge)
            .filter(isConditionBranch),
    );
}

export function getAvailableConditionBranchForEdges(
    sourceNodeId: string,
    edges: Edge[],
): ConditionBranch | null {
    const usedBranches = getUsedConditionBranches(sourceNodeId, edges);

    if (!usedBranches.has('yes')) {
        return 'yes';
    }

    if (!usedBranches.has('no')) {
        return 'no';
    }

    return null;
}

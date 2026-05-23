const PENDING_NOTEBOOK_ID_PREFIX = 'pending-notebook:';
const PENDING_WORKFLOW_ID_PREFIX = 'pending-workflow:';

function createPendingId(prefix: string, originalId?: string | null) {
    return `${prefix}${originalId && originalId.trim() ? originalId : crypto.randomUUID()}`;
}

function isPendingId(value: string | null | undefined, prefix: string) {
    return Boolean(value?.startsWith(prefix));
}

function getOriginalId(value: string | null | undefined, prefix: string) {
    if (!value) {
        return undefined;
    }

    if (!value.startsWith(prefix)) {
        return value;
    }

    const originalId = value.substring(prefix.length).trim();
    return originalId || undefined;
}

export function createPendingNotebookId(originalId?: string | null) {
    return createPendingId(PENDING_NOTEBOOK_ID_PREFIX, originalId);
}

export function createPendingWorkflowId(originalId?: string | null) {
    return createPendingId(PENDING_WORKFLOW_ID_PREFIX, originalId);
}

export function isPendingNotebookId(value: string | null | undefined) {
    return isPendingId(value, PENDING_NOTEBOOK_ID_PREFIX);
}

export function isPendingWorkflowId(value: string | null | undefined) {
    return isPendingId(value, PENDING_WORKFLOW_ID_PREFIX);
}

export function getOriginalNotebookId(value: string | null | undefined) {
    return getOriginalId(value, PENDING_NOTEBOOK_ID_PREFIX);
}

export function getOriginalWorkflowId(value: string | null | undefined) {
    return getOriginalId(value, PENDING_WORKFLOW_ID_PREFIX);
}

export function hasPendingBackendId(value: string | null | undefined) {
    return isPendingNotebookId(value) || isPendingWorkflowId(value);
}

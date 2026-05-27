import type { NotebookPayloadDto } from '../components/notebook/notebookBackendTypes';
import { isDemoNotebookId, loadNotebookLocally, saveNotebookLocally } from './notebookStorage';

const NOTEBOOK_DRAFT_AUTOSAVE_DELAY_MS = 1000;
const AUTOSAVE_REASON = 'canvas-draft-autosave';

const autosaveTimers = new Map<string, number>();
const pendingPayloads = new Map<string, NotebookPayloadDto>();

function getPayloadStorageKey(payload: NotebookPayloadDto) {
    return payload.id ?? 'draft';
}

function shouldAutosavePayload(payload: NotebookPayloadDto) {
    const hasContent =
        payload.blocks.length > 0 ||
        payload.connections.length > 0 ||
        Boolean(payload.serverNotebookId) ||
        Boolean(payload.workflowId);

    return Boolean(payload.id) && !isDemoNotebookId(payload.id) && hasContent;
}

function mergeWithExistingLocalPayload(payload: NotebookPayloadDto): NotebookPayloadDto {
    if (!payload.id) {
        return payload;
    }

    const existingPayload = loadNotebookLocally(payload.id);

    if (!existingPayload) {
        return payload;
    }

    return {
        ...payload,
        serverNotebookId: payload.serverNotebookId ?? existingPayload.serverNotebookId,
        workflowId: payload.workflowId ?? existingPayload.workflowId,
        workflowStatus: payload.workflowStatus ?? existingPayload.workflowStatus,
    };
}

function persistAutosavePayload(storageKey: string, payload: NotebookPayloadDto) {
    autosaveTimers.delete(storageKey);
    pendingPayloads.delete(storageKey);

    if (!shouldAutosavePayload(payload)) {
        return;
    }

    const payloadToSave = mergeWithExistingLocalPayload({
        ...payload,
        updatedAt: new Date().toISOString(),
    });

    saveNotebookLocally(payloadToSave, {
        enqueueSync: false,
        skipSyncQueue: true,
        syncReason: AUTOSAVE_REASON,
    });
}

export function scheduleNotebookDraftAutosave(payload: NotebookPayloadDto) {
    if (!shouldAutosavePayload(payload)) {
        return;
    }

    const storageKey = getPayloadStorageKey(payload);
    const existingTimerId = autosaveTimers.get(storageKey);

    pendingPayloads.set(storageKey, payload);

    if (existingTimerId !== undefined) {
        window.clearTimeout(existingTimerId);
    }

    const timerId = window.setTimeout(() => {
        const pendingPayload = pendingPayloads.get(storageKey);

        if (!pendingPayload) {
            autosaveTimers.delete(storageKey);
            return;
        }

        persistAutosavePayload(storageKey, pendingPayload);
    }, NOTEBOOK_DRAFT_AUTOSAVE_DELAY_MS);

    autosaveTimers.set(storageKey, timerId);
}

export function flushNotebookDraftAutosave(payload?: NotebookPayloadDto | null) {
    if (payload && shouldAutosavePayload(payload)) {
        const storageKey = getPayloadStorageKey(payload);
        const existingTimerId = autosaveTimers.get(storageKey);

        if (existingTimerId !== undefined) {
            window.clearTimeout(existingTimerId);
        }

        persistAutosavePayload(storageKey, payload);
        return;
    }

    for (const [storageKey, pendingPayload] of pendingPayloads.entries()) {
        const existingTimerId = autosaveTimers.get(storageKey);

        if (existingTimerId !== undefined) {
            window.clearTimeout(existingTimerId);
        }

        persistAutosavePayload(storageKey, pendingPayload);
    }
}

export function cancelNotebookDraftAutosave(notebookId: string) {
    const existingTimerId = autosaveTimers.get(notebookId);

    if (existingTimerId !== undefined) {
        window.clearTimeout(existingTimerId);
    }

    autosaveTimers.delete(notebookId);
    pendingPayloads.delete(notebookId);
}

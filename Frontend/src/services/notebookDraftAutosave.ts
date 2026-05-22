import type { NotebookPayloadDto } from '../components/notebook/notebookBackendTypes';
import { loadNotebookLocally, saveNotebookLocally } from './notebookStorage';

const NOTEBOOK_DRAFT_AUTOSAVE_DELAY_MS = 1000;
const AUTOSAVE_REASON = 'canvas-draft-autosave';

const autosaveTimers = new Map<string, number>();

function getPayloadStorageKey(payload: NotebookPayloadDto) {
    return payload.id ?? 'draft';
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

export function scheduleNotebookDraftAutosave(payload: NotebookPayloadDto) {
    if (!payload.id) {
        return;
    }

    const storageKey = getPayloadStorageKey(payload);
    const existingTimerId = autosaveTimers.get(storageKey);

    if (existingTimerId !== undefined) {
        window.clearTimeout(existingTimerId);
    }

    const timerId = window.setTimeout(() => {
        autosaveTimers.delete(storageKey);

        const payloadToSave = mergeWithExistingLocalPayload({
            ...payload,
            updatedAt: new Date().toISOString(),
        });

        saveNotebookLocally(payloadToSave, {
            enqueueSync: true,
            syncReason: AUTOSAVE_REASON,
        });
    }, NOTEBOOK_DRAFT_AUTOSAVE_DELAY_MS);

    autosaveTimers.set(storageKey, timerId);
}

export function flushNotebookDraftAutosave(payload: NotebookPayloadDto) {
    if (!payload.id) {
        return;
    }

    const storageKey = getPayloadStorageKey(payload);
    const existingTimerId = autosaveTimers.get(storageKey);

    if (existingTimerId !== undefined) {
        window.clearTimeout(existingTimerId);
        autosaveTimers.delete(storageKey);
    }

    const payloadToSave = mergeWithExistingLocalPayload({
        ...payload,
        updatedAt: new Date().toISOString(),
    });

    saveNotebookLocally(payloadToSave, {
        enqueueSync: true,
        syncReason: AUTOSAVE_REASON,
    });
}

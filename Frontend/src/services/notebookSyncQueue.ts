import type { NotebookPayloadDto } from '../components/notebook/notebookBackendTypes';
import { getStoredAuthUser } from '../auth/authStorage';

const SYNC_STORAGE_KEY = 'flowact-notebook-pending-sync';
const ANONYMOUS_SCOPE = 'anonymous';

export type PendingNotebookSyncItem = {
    notebookId: string;
    payload: NotebookPayloadDto;
    reason: string;
    createdAt: string;
    updatedAt: string;
    attempts: number;
    lastError?: string | null;
};

function getScope() {
    return getStoredAuthUser()?.id ?? ANONYMOUS_SCOPE;
}

function getStorageKey() {
    return `${SYNC_STORAGE_KEY}:${getScope()}`;
}

function readItems(): PendingNotebookSyncItem[] {
    const raw = localStorage.getItem(getStorageKey());

    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw) as PendingNotebookSyncItem[];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        localStorage.removeItem(getStorageKey());
        return [];
    }
}

function writeItems(items: PendingNotebookSyncItem[]) {
    localStorage.setItem(getStorageKey(), JSON.stringify(items, null, 2));
}

export function listPendingNotebookSyncItems() {
    return readItems();
}

export function getPendingNotebookSyncItem(notebookId: string) {
    return readItems().find((item) => item.notebookId === notebookId) ?? null;
}

export function hasPendingNotebookSync(notebookId: string) {
    return Boolean(getPendingNotebookSyncItem(notebookId));
}

export function enqueueNotebookSync(
    payload: NotebookPayloadDto,
    reason: string,
    lastError?: string | null,
) {
    if (!payload.id) {
        return null;
    }

    const now = new Date().toISOString();
    const items = readItems();
    const existingItem = items.find((item) => item.notebookId === payload.id);

    const nextItem: PendingNotebookSyncItem = {
        notebookId: payload.id,
        payload,
        reason,
        createdAt: existingItem?.createdAt ?? now,
        updatedAt: now,
        attempts: existingItem?.attempts ?? 0,
        lastError: lastError ?? existingItem?.lastError ?? null,
    };

    writeItems([
        nextItem,
        ...items.filter((item) => item.notebookId !== payload.id),
    ]);

    return nextItem;
}

export function removeNotebookSyncItem(notebookId: string) {
    writeItems(readItems().filter((item) => item.notebookId !== notebookId));
}

export function markNotebookSyncAttempt(notebookId: string, lastError?: string | null) {
    const now = new Date().toISOString();

    writeItems(readItems().map((item) => {
        if (item.notebookId !== notebookId) {
            return item;
        }

        return {
            ...item,
            attempts: item.attempts + 1,
            updatedAt: now,
            lastError: lastError ?? item.lastError ?? null,
        };
    }));
}

export function isRetryableNotebookSyncError(error: unknown) {
    if (!window.navigator.onLine) {
        return true;
    }

    if (error instanceof TypeError) {
        return true;
    }

    if (
        error &&
        typeof error === 'object' &&
        'status' in error &&
        typeof (error as { status?: unknown }).status === 'number'
    ) {
        const status = (error as { status: number }).status;
        return status === 408 || status === 429 || status >= 500;
    }

    return false;
}

export function getNotebookSyncErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    return 'Unknown sync error';
}

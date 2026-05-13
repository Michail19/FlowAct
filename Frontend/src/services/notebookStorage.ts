import type { NotebookPayloadDto } from '../components/notebook/notebookBackendTypes';
import { getStoredAuthUser } from '../auth/authStorage';

const NOTEBOOK_LIST_KEY = 'flowact-notebooks';
const NOTEBOOK_KEY_PREFIX = 'flowact-notebook:';
const ANONYMOUS_STORAGE_SCOPE = 'anonymous';

export type NotebookListItem = {
    id: string;
    title: string;
    updatedAt: string;
    blocksCount: number;
    connectionsCount: number;
};

function getCurrentStorageScope() {
    return getStoredAuthUser()?.id ?? ANONYMOUS_STORAGE_SCOPE;
}

function getNotebookListStorageKey() {
    return `${NOTEBOOK_LIST_KEY}:${getCurrentStorageScope()}`;
}

function getNotebookStorageKey(notebookId: string) {
    return `${NOTEBOOK_KEY_PREFIX}${getCurrentStorageScope()}:${notebookId}`;
}

function safeParseNotebook(rawPayload: string | null): NotebookPayloadDto | null {
    if (!rawPayload) {
        return null;
    }

    try {
        return JSON.parse(rawPayload) as NotebookPayloadDto;
    } catch {
        return null;
    }
}

function safeParseNotebookList(rawList: string | null): NotebookListItem[] {
    if (!rawList) {
        return [];
    }

    try {
        return JSON.parse(rawList) as NotebookListItem[];
    } catch {
        localStorage.removeItem(getNotebookListStorageKey());
        return [];
    }
}

function toNotebookListItem(payload: NotebookPayloadDto): NotebookListItem {
    return {
        id: payload.id ?? crypto.randomUUID(),
        title: payload.title || 'Без названия',
        updatedAt: payload.updatedAt,
        blocksCount: payload.blocks.length,
        connectionsCount: payload.connections.length,
    };
}

function getNotebookServerId(notebookId: string) {
    return safeParseNotebook(
        localStorage.getItem(getNotebookStorageKey(notebookId)),
    )?.serverNotebookId;
}

function dedupeNotebookListByServerId(list: NotebookListItem[]) {
    const seenServerIds = new Set<string>();

    return list.filter((item) => {
        const serverNotebookId = getNotebookServerId(item.id);

        if (!serverNotebookId) {
            return true;
        }

        if (seenServerIds.has(serverNotebookId)) {
            return false;
        }

        seenServerIds.add(serverNotebookId);
        return true;
    });
}

export function listNotebooksLocally(): NotebookListItem[] {
    const sortedList = safeParseNotebookList(localStorage.getItem(getNotebookListStorageKey())).sort(
        (firstNotebook, secondNotebook) =>
            new Date(secondNotebook.updatedAt).getTime() -
            new Date(firstNotebook.updatedAt).getTime(),
    );

    return dedupeNotebookListByServerId(sortedList);
}

export function saveNotebookLocally(payload: NotebookPayloadDto): NotebookPayloadDto {
    const notebookId = payload.id ?? crypto.randomUUID();

    const normalizedPayload: NotebookPayloadDto = {
        ...payload,
        id: notebookId,
        updatedAt: payload.updatedAt || new Date().toISOString(),
    };

    localStorage.setItem(
        getNotebookStorageKey(notebookId),
        JSON.stringify(normalizedPayload, null, 2),
    );

    const list = listNotebooksLocally();
    const nextItem = toNotebookListItem(normalizedPayload);

    const nextList = [
        nextItem,
        ...list.filter((item) => {
            if (item.id === notebookId) {
                return false;
            }

            if (
                normalizedPayload.serverNotebookId &&
                getNotebookServerId(item.id) === normalizedPayload.serverNotebookId
            ) {
                localStorage.removeItem(getNotebookStorageKey(item.id));
                return false;
            }

            return true;
        }),
    ];

    localStorage.setItem(getNotebookListStorageKey(), JSON.stringify(nextList, null, 2));

    return normalizedPayload;
}

export function loadNotebookLocally(notebookId: string): NotebookPayloadDto | null {
    const payload = safeParseNotebook(
        localStorage.getItem(getNotebookStorageKey(notebookId)),
    );

    if (!payload) {
        return null;
    }

    return payload;
}

export function deleteNotebookLocally(notebookId: string) {
    localStorage.removeItem(getNotebookStorageKey(notebookId));

    const nextList = listNotebooksLocally().filter(
        (notebook) => notebook.id !== notebookId,
    );

    localStorage.setItem(getNotebookListStorageKey(), JSON.stringify(nextList, null, 2));
}

export function createEmptyNotebookLocally(title = 'Новый notebook'): NotebookPayloadDto {
    const now = new Date().toISOString();

    return saveNotebookLocally({
        id: crypto.randomUUID(),
        title,
        version: 1,
        blocks: [],
        connections: [],
        updatedAt: now,
    });
}

export function clearLegacyNotebookStorage() {
    localStorage.removeItem(NOTEBOOK_LIST_KEY);

    Object.keys(localStorage)
        .filter((key) => key.startsWith(NOTEBOOK_KEY_PREFIX) && !key.startsWith(`${NOTEBOOK_KEY_PREFIX}${getCurrentStorageScope()}:`))
        .forEach((key) => {
            if (!key.includes(':', NOTEBOOK_KEY_PREFIX.length)) {
                localStorage.removeItem(key);
            }
        });
}

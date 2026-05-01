import type { NotebookPayloadDto } from '../components/notebook/notebookBackendTypes';

const NOTEBOOK_LIST_KEY = 'flowact-notebooks';
const NOTEBOOK_KEY_PREFIX = 'flowact-notebook:';

export type NotebookListItem = {
    id: string;
    title: string;
    updatedAt: string;
    blocksCount: number;
    connectionsCount: number;
};

function getNotebookStorageKey(notebookId: string) {
    return `${NOTEBOOK_KEY_PREFIX}${notebookId}`;
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
        localStorage.removeItem(NOTEBOOK_LIST_KEY);
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

export function listNotebooksLocally(): NotebookListItem[] {
    return safeParseNotebookList(localStorage.getItem(NOTEBOOK_LIST_KEY)).sort(
        (firstNotebook, secondNotebook) =>
            new Date(secondNotebook.updatedAt).getTime() -
            new Date(firstNotebook.updatedAt).getTime(),
    );
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
        ...list.filter((item) => item.id !== notebookId),
    ];

    localStorage.setItem(NOTEBOOK_LIST_KEY, JSON.stringify(nextList, null, 2));

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

    localStorage.setItem(NOTEBOOK_LIST_KEY, JSON.stringify(nextList, null, 2));
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

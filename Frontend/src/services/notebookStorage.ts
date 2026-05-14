import type { NotebookPayloadDto } from '../components/notebook/notebookBackendTypes';
import { getStoredAuthUser } from '../auth/authStorage';

const NOTEBOOK_LIST_KEY = 'flowact-notebooks';
const NOTEBOOK_KEY_PREFIX = 'flowact-notebook:';
const DEMO_NOTEBOOK_ID_PREFIX = 'demo-notebook-';
const ANONYMOUS_STORAGE_SCOPE = 'anonymous';

const demoNotebookMemoryStorage = new Map<string, NotebookPayloadDto>();

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

export function isDemoNotebookId(notebookId?: string | null) {
    return Boolean(notebookId?.startsWith(DEMO_NOTEBOOK_ID_PREFIX));
}

export function clearDemoNotebooksLocally() {
    demoNotebookMemoryStorage.clear();
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

    if (isDemoNotebookId(notebookId)) {
        demoNotebookMemoryStorage.set(notebookId, normalizedPayload);
        return normalizedPayload;
    }

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
    if (isDemoNotebookId(notebookId)) {
        return demoNotebookMemoryStorage.get(notebookId) ?? null;
    }

    const payload = safeParseNotebook(
        localStorage.getItem(getNotebookStorageKey(notebookId)),
    );

    if (!payload) {
        return null;
    }

    return payload;
}

export function deleteNotebookLocally(notebookId: string) {
    if (isDemoNotebookId(notebookId)) {
        demoNotebookMemoryStorage.delete(notebookId);
        return;
    }

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

export function createDemoNotebookLocally(): NotebookPayloadDto {
    const now = new Date().toISOString();
    const startBlockId = 'demo-start';
    const conditionBlockId = 'demo-condition';
    const aiBlockId = 'demo-ai';
    const logBlockId = 'demo-log';
    const endBlockId = 'demo-end';

    return saveNotebookLocally({
        id: `${DEMO_NOTEBOOK_ID_PREFIX}${crypto.randomUUID()}`,
        title: 'Demo notebook',
        version: 1,
        blocks: [
            {
                id: startBlockId,
                type: 'start',
                title: 'Старт',
                subtitle: 'Точка запуска',
                description: 'Начало demo workflow.',
                position: { x: 80, y: 180 },
                status: 'idle',
            },
            {
                id: conditionBlockId,
                type: 'condition',
                title: 'IF',
                subtitle: 'Проверка условия',
                description: 'Пример ветвления процесса.',
                position: { x: 360, y: 180 },
                config: {
                    condition: {
                        leftValue: '{{input.type}}',
                        operator: 'exists',
                        rightValue: '',
                    },
                },
                status: 'idle',
            },
            {
                id: aiBlockId,
                type: 'ai',
                title: 'AI-анализ',
                subtitle: 'Demo prompt',
                description: 'Пример AI-блока для анализа текста.',
                position: { x: 640, y: 80 },
                config: {
                    ai: {
                        prompt: 'Кратко проанализируй входные данные и выдели следующий шаг.',
                        models: ['demo-model'],
                        inputMode: 'smart',
                        maxInputChars: 2000,
                    },
                },
                status: 'idle',
            },
            {
                id: logBlockId,
                type: 'log',
                title: 'Лог',
                subtitle: 'Сохранение результата',
                description: 'Записывает итог выполнения предыдущего блока.',
                position: { x: 640, y: 300 },
                config: {
                    log: {
                        level: 'info',
                        messageTemplate: 'Demo workflow выполнен: {{result}}',
                    },
                },
                status: 'idle',
            },
            {
                id: endBlockId,
                type: 'end',
                title: 'Конец',
                subtitle: 'Завершение процесса',
                description: 'Финальная точка demo workflow.',
                position: { x: 920, y: 180 },
                status: 'idle',
            },
        ],
        connections: [
            {
                id: 'demo-connection-start-condition',
                sourceBlockId: startBlockId,
                targetBlockId: conditionBlockId,
            },
            {
                id: 'demo-connection-condition-ai',
                sourceBlockId: conditionBlockId,
                targetBlockId: aiBlockId,
                label: 'Да',
            },
            {
                id: 'demo-connection-condition-log',
                sourceBlockId: conditionBlockId,
                targetBlockId: logBlockId,
                label: 'Нет',
            },
            {
                id: 'demo-connection-ai-end',
                sourceBlockId: aiBlockId,
                targetBlockId: endBlockId,
            },
            {
                id: 'demo-connection-log-end',
                sourceBlockId: logBlockId,
                targetBlockId: endBlockId,
            },
        ],
        viewport: { x: 80, y: 80, zoom: 0.75 },
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

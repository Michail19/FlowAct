import type { NotebookPayloadDto } from '../components/notebook/notebookBackendTypes';

const STORAGE_KEY = 'flowact-current-notebook';

export function saveNotebookLocally(payload: NotebookPayloadDto) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload, null, 2));
}

export function loadNotebookLocally(): NotebookPayloadDto | null {
    const rawPayload = localStorage.getItem(STORAGE_KEY);

    if (!rawPayload) {
        return null;
    }

    try {
        return JSON.parse(rawPayload) as NotebookPayloadDto;
    } catch {
        localStorage.removeItem(STORAGE_KEY);
        return null;
    }
}

export function clearLocalNotebook() {
    localStorage.removeItem(STORAGE_KEY);
}

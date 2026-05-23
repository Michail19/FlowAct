import { apiClient } from './apiClient';
import { createPendingNotebookId, isPendingNotebookId } from './pendingBackendIds';
import { isRetryableNotebookSyncError } from './notebookSyncQueue';
import { createPersistenceError } from './persistenceError';

const NOTEBOOKS_ENDPOINT = '/v1/notebooks';

export type NotebookRequest = {
    name: string;
    description?: string | null;
};

export type NotebookShortResponse = {
    id: string;
    ownerUserId: string;
    name: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
};

export type NotebookResponse = NotebookShortResponse;

function createLocalNotebookResponse(
    request: NotebookRequest,
    id = createPendingNotebookId(),
): NotebookResponse {
    const now = new Date().toISOString();

    return {
        id,
        ownerUserId: 'local',
        name: request.name,
        description: request.description ?? null,
        createdAt: now,
        updatedAt: now,
    };
}

export const notebookApi = {
    getNotebook(notebookId: string) {
        return apiClient.get<NotebookResponse>(`${NOTEBOOKS_ENDPOINT}/${notebookId}`);
    },

    getNotebooks() {
        return apiClient.get<NotebookShortResponse[]>(NOTEBOOKS_ENDPOINT);
    },

    async createNotebook(request: NotebookRequest) {
        try {
            return await apiClient.post<NotebookResponse>(NOTEBOOKS_ENDPOINT, request);
        } catch (error) {
            if (isRetryableNotebookSyncError(error)) {
                return createLocalNotebookResponse(request);
            }

            throw createPersistenceError('notebook', error);
        }
    },

    async updateNotebook(notebookId: string, request: NotebookRequest) {
        if (isPendingNotebookId(notebookId)) {
            return createLocalNotebookResponse(request, notebookId);
        }

        try {
            return await apiClient.put<NotebookResponse>(
                `${NOTEBOOKS_ENDPOINT}/${notebookId}`,
                request,
            );
        } catch (error) {
            if (isRetryableNotebookSyncError(error)) {
                return createLocalNotebookResponse(request, createPendingNotebookId(notebookId));
            }

            throw createPersistenceError('notebook', error);
        }
    },

    deleteNotebook(notebookId: string) {
        return apiClient.delete<void>(`${NOTEBOOKS_ENDPOINT}/${notebookId}`);
    },
};

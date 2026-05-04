import { apiClient } from './apiClient';

const NOTEBOOKS_ENDPOINT = '/v1/notebooks';

export type NotebookRequest = {
    name: string;
    description?: string | null;
};

export type NotebookResponse = {
    id: string;
    ownerUserId: string;
    name: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
};

export const notebookApi = {
    getNotebook(notebookId: string) {
        return apiClient.get<NotebookResponse>(`${NOTEBOOKS_ENDPOINT}/${notebookId}`);
    },

    getNotebooks() {
        return apiClient.get<NotebookResponse[]>(NOTEBOOKS_ENDPOINT);
    },

    createNotebook(request: NotebookRequest) {
        return apiClient.post<NotebookResponse>(NOTEBOOKS_ENDPOINT, request);
    },

    updateNotebook(notebookId: string, request: NotebookRequest) {
        return apiClient.put<NotebookResponse>(
            `${NOTEBOOKS_ENDPOINT}/${notebookId}`,
            request,
        );
    },

    deleteNotebook(notebookId: string) {
        return apiClient.delete<void>(`${NOTEBOOKS_ENDPOINT}/${notebookId}`);
    },
};

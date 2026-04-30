import type { NotebookPayloadDto } from '../components/notebook/notebookBackendTypes';

import { apiClient } from './apiClient';

const NOTEBOOKS_ENDPOINT = '/notebooks';

export const notebookApi = {
    getNotebook(notebookId: string) {
        return apiClient.get<NotebookPayloadDto>(`${NOTEBOOKS_ENDPOINT}/${notebookId}`);
    },

    createNotebook(payload: NotebookPayloadDto) {
        return apiClient.post<NotebookPayloadDto>(NOTEBOOKS_ENDPOINT, payload);
    },

    updateNotebook(notebookId: string, payload: NotebookPayloadDto) {
        return apiClient.put<NotebookPayloadDto>(
            `${NOTEBOOKS_ENDPOINT}/${notebookId}`,
            payload,
        );
    },

    saveNotebook(payload: NotebookPayloadDto) {
        if (payload.id) {
            return this.updateNotebook(payload.id, payload);
        }

        return this.createNotebook(payload);
    },

    deleteNotebook(notebookId: string) {
        return apiClient.delete<void>(`${NOTEBOOKS_ENDPOINT}/${notebookId}`);
    },
};

import { apiClient } from './apiClient';
import type { AuthResponse } from './authApi';

export const demoAuthApi = {
    startDemo() {
        return apiClient.post<AuthResponse>('/v1/auth/demo', undefined, {
            auth: false,
        });
    },
};

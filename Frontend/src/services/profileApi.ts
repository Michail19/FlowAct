import { apiClient } from './apiClient';
import type { AuthUser } from './authApi';

export type UpdateProfileRequest = {
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
};

export const profileApi = {
    updateCurrentUser(request: UpdateProfileRequest) {
        return apiClient.patch<AuthUser>('/v1/users/me', request);
    },
};

import { apiClient } from './apiClient';
import type { StoredAuthUser } from '../auth/authStorage';

export type AuthUser = StoredAuthUser & {
    status?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

export type AuthResponse = {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
};

export type TokenResponse = {
    accessToken: string;
    refreshToken: string;
};

export type LoginRequest = {
    email: string;
    password: string;
};

export type RegisterRequest = {
    email: string;
    password: string;
    displayName?: string | null;
};

export type UpdateCurrentUserRequest = {
    displayName?: string | null;
};

export const authApi = {
    register(request: RegisterRequest) {
        return apiClient.post<AuthResponse>('/v1/auth/register', request, {
            auth: false,
        });
    },

    login(request: LoginRequest) {
        return apiClient.post<AuthResponse>('/v1/auth/login', request, {
            auth: false,
        });
    },

    logout(refreshToken: string) {
        return apiClient.post<void>('/v1/auth/logout', { refreshToken }, {
            auth: false,
        });
    },

    getCurrentUser() {
        return apiClient.get<AuthUser>('/v1/users/me');
    },

    updateCurrentUser(request: UpdateCurrentUserRequest) {
        return apiClient.patch<AuthUser>('/v1/users/me', request);
    },
};

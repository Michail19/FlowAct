import { apiClient } from './apiClient';

export type AdminUserRole = 'USER' | 'ADMIN';
export type AdminUserStatus = 'ACTIVE' | 'BLOCKED' | 'DELETED';
export type AdminUserAccountType = 'REGULAR' | 'DEMO';

export type AdminUser = {
    id: string;
    email: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    role: AdminUserRole;
    status: AdminUserStatus;
    accountType: AdminUserAccountType;
    demoExpiresAt?: string | null;
    lastLoginAt?: string | null;
    createdAt: string;
    updatedAt: string;
};

export type AdminStats = {
    totalUsers: number;
    regularUsers: number;
    demoUsers: number;
    activeUsers: number;
    blockedUsers: number;
    deletedUsers: number;
    adminUsers: number;
    activeRefreshTokens: number;
};

export type AdminActionResponse = {
    affectedCount: number;
};

export const adminApi = {
    getStats() {
        return apiClient.get<AdminStats>('/v1/admin/stats');
    },

    getUsers() {
        return apiClient.get<AdminUser[]>('/v1/admin/users');
    },

    getUser(userId: string) {
        return apiClient.get<AdminUser>(`/v1/admin/users/${userId}`);
    },

    updateUserRole(userId: string, role: AdminUserRole) {
        return apiClient.patch<AdminUser>(`/v1/admin/users/${userId}/role`, { role });
    },

    updateUserStatus(userId: string, status: AdminUserStatus) {
        return apiClient.patch<AdminUser>(`/v1/admin/users/${userId}/status`, { status });
    },

    revokeUserSessions(userId: string) {
        return apiClient.post<AdminActionResponse>(`/v1/admin/users/${userId}/revoke-sessions`);
    },

    cleanupExpiredDemoUsers() {
        return apiClient.delete<AdminActionResponse>('/v1/admin/demo-users/expired');
    },
};

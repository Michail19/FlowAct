import {
    clearAuthStorage,
    getStoredAccessToken,
    getStoredAuthUser,
    getStoredRefreshToken,
    setStoredAccessToken,
    setStoredAuthUser,
    setStoredRefreshToken,
    type StoredAuthUser,
} from './authStorage';

export type AuthSession = {
    accessToken: string | null;
    refreshToken: string | null;
    user: StoredAuthUser | null;
    isAuthenticated: boolean;
};

export type AuthSessionInput = {
    accessToken: string;
    refreshToken?: string | null;
    user?: StoredAuthUser | null;
};

export function getAuthSession(): AuthSession {
    const accessToken = getStoredAccessToken();
    const refreshToken = getStoredRefreshToken();
    const user = getStoredAuthUser();

    return {
        accessToken,
        refreshToken,
        user,
        isAuthenticated: Boolean(accessToken),
    };
}

export function saveAuthSession(session: AuthSessionInput) {
    setStoredAccessToken(session.accessToken);
    setStoredRefreshToken(session.refreshToken ?? null);
    setStoredAuthUser(session.user ?? null);
}

export function clearAuthSession() {
    clearAuthStorage();
}

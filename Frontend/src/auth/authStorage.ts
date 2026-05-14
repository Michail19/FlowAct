export const ACCESS_TOKEN_STORAGE_KEY = 'flowact-access-token';
export const REFRESH_TOKEN_STORAGE_KEY = 'flowact-refresh-token';
export const AUTH_USER_STORAGE_KEY = 'flowact-auth-user';

export type StoredAuthUser = {
    id: string;
    email?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    role?: string | null;
    accountType?: string | null;
    demoExpiresAt?: string | null;
};

function getLocalStorage(): Storage | null {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.localStorage;
}

function safeParseAuthUser(rawUser: string | null): StoredAuthUser | null {
    if (!rawUser) {
        return null;
    }

    try {
        const parsedUser = JSON.parse(rawUser) as Partial<StoredAuthUser>;

        if (typeof parsedUser.id !== 'string' || !parsedUser.id.trim()) {
            return null;
        }

        return {
            id: parsedUser.id,
            email: parsedUser.email ?? null,
            displayName: parsedUser.displayName ?? null,
            avatarUrl: parsedUser.avatarUrl ?? null,
            role: parsedUser.role ?? null,
            accountType: parsedUser.accountType ?? null,
            demoExpiresAt: parsedUser.demoExpiresAt ?? null,
        };
    } catch {
        getLocalStorage()?.removeItem(AUTH_USER_STORAGE_KEY);
        return null;
    }
}

export function getStoredAccessToken(): string | null {
    return getLocalStorage()?.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? null;
}

export function setStoredAccessToken(token: string | null) {
    const storage = getLocalStorage();

    if (!storage) {
        return;
    }

    if (!token) {
        storage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
        return;
    }

    storage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
}

export function getStoredRefreshToken(): string | null {
    return getLocalStorage()?.getItem(REFRESH_TOKEN_STORAGE_KEY) ?? null;
}

export function setStoredRefreshToken(token: string | null) {
    const storage = getLocalStorage();

    if (!storage) {
        return;
    }

    if (!token) {
        storage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
        return;
    }

    storage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
}

export function getStoredAuthUser(): StoredAuthUser | null {
    return safeParseAuthUser(
        getLocalStorage()?.getItem(AUTH_USER_STORAGE_KEY) ?? null,
    );
}

export function setStoredAuthUser(user: StoredAuthUser | null) {
    const storage = getLocalStorage();

    if (!storage) {
        return;
    }

    if (!user) {
        storage.removeItem(AUTH_USER_STORAGE_KEY);
        return;
    }

    storage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearAuthStorage() {
    const storage = getLocalStorage();

    if (!storage) {
        return;
    }

    storage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    storage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    storage.removeItem(AUTH_USER_STORAGE_KEY);
}

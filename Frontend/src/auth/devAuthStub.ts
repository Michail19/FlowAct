const DEFAULT_DEV_USER_ID = "11111111-1111-1111-1111-111111111111";

export function isDevAuthEnabled(): boolean {
    return import.meta.env.VITE_DEV_AUTH_ENABLED === "true";
}

export function getDevUserId(): string {
    return import.meta.env.VITE_DEV_USER_ID || DEFAULT_DEV_USER_ID;
}

export function getDevAuthToken(): string {
    return import.meta.env.VITE_DEV_AUTH_TOKEN || "dev-token";
}

export function getDevAuthHeaders(): Record<string, string> {
    if (!isDevAuthEnabled()) {
        return {};
    }

    return {
        "X-User-Id": getDevUserId(),
        Authorization: `Bearer ${getDevAuthToken()}`,
    };
}

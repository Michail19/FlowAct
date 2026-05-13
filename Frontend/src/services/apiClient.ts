import { applyAuthHeaders } from '../auth/authHeaders';
import {
    clearAuthSession,
    getAuthSession,
    saveAuthSession,
} from '../auth/authSession';

const DEFAULT_API_BASE_URL = '/api';
const AUTH_REFRESH_PATH = '/v1/auth/refresh';

type ApiRequestOptions = RequestInit & {
    json?: unknown;
    auth?: boolean;
};

type TokenResponse = {
    accessToken: string;
    refreshToken: string;
};

export class ApiError extends Error {
    status: number;
    payload: unknown;

    constructor(message: string, status: number, payload: unknown = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.payload = payload;
    }
}

let refreshPromise: Promise<TokenResponse> | null = null;

function getApiBaseUrl() {
    return import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
}

function shouldClearAuthSession(status: number) {
    return status === 401 || status === 403;
}

function shouldRefreshAuthSession(path: string, status: number, auth: boolean) {
    return auth && status === 401 && path !== AUTH_REFRESH_PATH;
}

async function parseResponseBody(response: Response) {
    const contentType = response.headers.get('content-type');

    if (response.status === 204) {
        return null;
    }

    if (contentType?.includes('application/json')) {
        return response.json();
    }

    return response.text();
}

async function refreshAuthSession() {
    const currentSession = getAuthSession();

    if (!currentSession.refreshToken) {
        throw new ApiError('Refresh token is missing', 401);
    }

    if (!refreshPromise) {
        refreshPromise = fetch(`${getApiBaseUrl()}${AUTH_REFRESH_PATH}`, {
            method: 'POST',
            headers: new Headers({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                refreshToken: currentSession.refreshToken,
            }),
        })
            .then(async (response) => {
                const payload = await parseResponseBody(response);

                if (!response.ok) {
                    throw new ApiError(
                        `Token refresh failed with status ${response.status}`,
                        response.status,
                        payload,
                    );
                }

                const tokenResponse = payload as TokenResponse;

                saveAuthSession({
                    accessToken: tokenResponse.accessToken,
                    refreshToken: tokenResponse.refreshToken,
                    user: currentSession.user,
                });

                return tokenResponse;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
}

function buildRequestHeaders(headers: HeadersInit | undefined, json: unknown, auth: boolean) {
    const requestHeaders = new Headers(headers);

    if (json !== undefined && !requestHeaders.has('Content-Type')) {
        requestHeaders.set('Content-Type', 'application/json');
    }

    if (auth) {
        applyAuthHeaders(requestHeaders);
    }

    return requestHeaders;
}

async function performFetch(
    path: string,
    json: unknown,
    auth: boolean,
    headers: HeadersInit | undefined,
    requestOptions: RequestInit,
) {
    return fetch(`${getApiBaseUrl()}${path}`, {
        ...requestOptions,
        headers: buildRequestHeaders(headers, json, auth),
        body: json !== undefined ? JSON.stringify(json) : requestOptions.body,
    });
}

async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const { json, auth = true, headers, ...requestOptions } = options;

    let response = await performFetch(path, json, auth, headers, requestOptions);

    if (shouldRefreshAuthSession(path, response.status, auth)) {
        try {
            await refreshAuthSession();
            response = await performFetch(path, json, auth, headers, requestOptions);
        } catch (error) {
            clearAuthSession();
            throw error;
        }
    }

    const payload = await parseResponseBody(response);

    if (!response.ok) {
        if (auth && shouldClearAuthSession(response.status)) {
            clearAuthSession();
        }

        throw new ApiError(
            `API request failed with status ${response.status}`,
            response.status,
            payload,
        );
    }

    return payload as T;
}

export const apiClient = {
    get<T>(path: string, options?: ApiRequestOptions) {
        return request<T>(path, {
            ...options,
            method: 'GET',
        });
    },

    post<T>(path: string, json?: unknown, options?: ApiRequestOptions) {
        return request<T>(path, {
            ...options,
            method: 'POST',
            json,
        });
    },

    put<T>(path: string, json?: unknown, options?: ApiRequestOptions) {
        return request<T>(path, {
            ...options,
            method: 'PUT',
            json,
        });
    },

    patch<T>(path: string, json?: unknown, options?: ApiRequestOptions) {
        return request<T>(path, {
            ...options,
            method: 'PATCH',
            json,
        });
    },

    delete<T>(path: string, options?: ApiRequestOptions) {
        return request<T>(path, {
            ...options,
            method: 'DELETE',
        });
    },
};

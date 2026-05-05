import { getDevAuthHeaders, isDevAuthEnabled } from "../auth/devAuthStub";

const DEFAULT_API_BASE_URL = '/api';

type ApiRequestOptions = RequestInit & {
    json?: unknown;
    auth?: boolean;
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

function getApiBaseUrl() {
    return import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
}

function getAccessToken() {
    return localStorage.getItem('flowact-access-token');
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

async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const { json, auth = true, headers, ...requestOptions } = options;

    const requestHeaders = new Headers(headers);

    if (!requestHeaders.has("Content-Type") || json !== undefined) {
        requestHeaders.set('Content-Type', 'application/json');
    }

    if (auth) {
        const token = getAccessToken();

        if (token) {
            requestHeaders.set('Authorization', `Bearer ${token}`);
        }
    }

    // Временная dev-заглушка.
    // Потом этот блок можно будет удалить или заменить на нормальный AuthProvider.
    if (isDevAuthEnabled()) {
        const devHeaders = getDevAuthHeaders();

        Object.entries(devHeaders).forEach(([key, value]) => {
            if (!requestHeaders.has(key)) {
                requestHeaders.set(key, value);
            }
        });
    }

    const response = await fetch(`${getApiBaseUrl()}${path}`, {
        ...requestOptions,
        headers: requestHeaders,
        body: json !== undefined ? JSON.stringify(json) : requestOptions.body,
    });

    const payload = await parseResponseBody(response);

    if (!response.ok) {
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

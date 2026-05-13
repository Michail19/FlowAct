#!/usr/bin/env node

import process from 'node:process';

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_PASSWORD = 'password123';
const TEST_RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const CREDENTIALS_UPDATE_PATH = `/api/v1/users/me/change-${'password'}`;

const args = new Map(
    process.argv
        .slice(2)
        .map((arg) => {
            const [key, ...valueParts] = arg.split('=');
            return [key, valueParts.join('=') || 'true'];
        }),
);

const baseUrl = (args.get('--base-url') || process.env.FLOWACT_E2E_BASE_URL || DEFAULT_BASE_URL)
    .replace(/\/$/, '');

const password = args.get('--password') || process.env.FLOWACT_E2E_PASSWORD || DEFAULT_PASSWORD;
const updatedSecret = `${password}Updated1`;

function logStep(message) {
    console.log(`\n[smoke-auth] ${message}`);
}

function logSuccess(message) {
    console.log(`[ok] ${message}`);
}

function buildEmail(prefix) {
    return `${prefix}.${TEST_RUN_ID}@flowact.local`;
}

async function parseResponse(response) {
    const contentType = response.headers.get('content-type') || '';

    if (response.status === 204) {
        return null;
    }

    if (contentType.includes('application/json')) {
        return response.json();
    }

    return response.text();
}

async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
            ...(options.headers || {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const payload = await parseResponse(response);

    return {
        response,
        payload,
    };
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function assertStatus(actual, expected, context) {
    assert(
        actual === expected,
        `${context}: expected HTTP ${expected}, got ${actual}`,
    );
}

function assertStatusOneOf(actual, expectedStatuses, context) {
    assert(
        expectedStatuses.includes(actual),
        `${context}: expected HTTP ${expectedStatuses.join(' or ')}, got ${actual}`,
    );
}

function assertAuthResponse(payload, context) {
    assert(payload, `${context}: response payload is empty`);
    assert(typeof payload.accessToken === 'string' && payload.accessToken.length > 0, `${context}: accessToken is missing`);
    assert(typeof payload.refreshToken === 'string' && payload.refreshToken.length > 0, `${context}: refreshToken is missing`);
    assert(payload.user?.id, `${context}: user.id is missing`);
    assert(payload.user?.email, `${context}: user.email is missing`);
}

async function registerUser(prefix, displayName) {
    const email = buildEmail(prefix);

    const { response, payload } = await request('/api/v1/auth/register', {
        method: 'POST',
        body: {
            email,
            password,
            displayName,
        },
    });

    assertStatus(response.status, 201, `register ${prefix}`);
    assertAuthResponse(payload, `register ${prefix}`);
    assert(payload.user.email === email, `register ${prefix}: expected email ${email}, got ${payload.user.email}`);

    return {
        email,
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        user: payload.user,
    };
}

async function loginUser(email, secret = password) {
    const { response, payload } = await request('/api/v1/auth/login', {
        method: 'POST',
        body: {
            email,
            password: secret,
        },
    });

    assertStatus(response.status, 200, `login ${email}`);
    assertAuthResponse(payload, `login ${email}`);

    return {
        email,
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        user: payload.user,
    };
}

async function listNotebooks(accessToken, context) {
    const { response, payload } = await request('/api/v1/notebooks', {
        method: 'GET',
        accessToken,
    });

    assertStatus(response.status, 200, context);
    assert(Array.isArray(payload), `${context}: expected notebook list array`);

    return payload;
}

async function run() {
    console.log(`[smoke-auth] baseUrl=${baseUrl}`);
    console.log(`[smoke-auth] runId=${TEST_RUN_ID}`);

    logStep('1. Protected notebooks endpoint without token must return 401');
    {
        const { response } = await request('/api/v1/notebooks', {
            method: 'GET',
        });

        assertStatus(response.status, 401, 'GET /api/v1/notebooks without token');
        logSuccess('protected endpoint returns 401 without token');
    }

    logStep('2. Register account A');
    const accountA = await registerUser('account-a', 'Smoke Account A');
    logSuccess(`account A registered: ${accountA.email}`);

    logStep('3. Account A creates notebook');
    const notebookName = `Smoke Notebook ${TEST_RUN_ID}`;
    const { response: createNotebookResponse, payload: createdNotebook } = await request('/api/v1/notebooks', {
        method: 'POST',
        accessToken: accountA.accessToken,
        body: {
            name: notebookName,
            description: 'Created by smoke auth flow test',
        },
    });

    assertStatus(createNotebookResponse.status, 201, 'create notebook as account A');
    assert(createdNotebook?.id, 'create notebook: id is missing');
    assert(createdNotebook?.name === notebookName, `create notebook: expected name ${notebookName}`);
    assert(createdNotebook?.ownerUserId === accountA.user.id, 'create notebook: ownerUserId must equal account A user id');
    logSuccess(`account A created notebook: ${createdNotebook.id}`);

    logStep('4. Account A sees its notebook');
    const notebooksA = await listNotebooks(accountA.accessToken, 'list notebooks as account A');
    assert(
        notebooksA.some((notebook) => notebook.id === createdNotebook.id),
        'account A list must contain created notebook',
    );
    logSuccess('account A sees created notebook');

    logStep('5. Register account B');
    const accountB = await registerUser('account-b', 'Smoke Account B');
    logSuccess(`account B registered: ${accountB.email}`);

    logStep('6. Account B must not see account A notebook');
    const notebooksB = await listNotebooks(accountB.accessToken, 'list notebooks as account B');
    assert(
        !notebooksB.some((notebook) => notebook.id === createdNotebook.id),
        'account B must not see account A notebook',
    );
    logSuccess('account B does not see account A notebook');

    logStep('7. Account B must not access account A notebook by id');
    {
        const { response } = await request(`/api/v1/notebooks/${createdNotebook.id}`, {
            method: 'GET',
            accessToken: accountB.accessToken,
        });

        assertStatusOneOf(
            response.status,
            [403, 404],
            'account B reads account A notebook by id',
        );
        logSuccess(`foreign notebook access denied with HTTP ${response.status}`);
    }

    logStep('8. Login account A again and verify notebook is still visible');
    const accountALogin = await loginUser(accountA.email);
    const notebooksAfterLoginA = await listNotebooks(accountALogin.accessToken, 'list notebooks after account A login');
    assert(
        notebooksAfterLoginA.some((notebook) => notebook.id === createdNotebook.id),
        'account A must see notebook after login',
    );
    logSuccess('account A sees notebook after login');

    logStep('9. Refresh account A token');
    const { response: refreshResponse, payload: refreshPayload } = await request('/api/v1/auth/refresh', {
        method: 'POST',
        body: {
            refreshToken: accountALogin.refreshToken,
        },
    });

    assertStatus(refreshResponse.status, 200, 'refresh account A token');
    assert(typeof refreshPayload?.accessToken === 'string' && refreshPayload.accessToken.length > 0, 'refresh: accessToken is missing');
    assert(typeof refreshPayload?.refreshToken === 'string' && refreshPayload.refreshToken.length > 0, 'refresh: refreshToken is missing');
    assert(
        refreshPayload.refreshToken !== accountALogin.refreshToken,
        'refresh token must be rotated',
    );
    logSuccess('refresh token rotated');

    logStep('10. Old refresh token must be rejected after rotation');
    {
        const { response } = await request('/api/v1/auth/refresh', {
            method: 'POST',
            body: {
                refreshToken: accountALogin.refreshToken,
            },
        });

        assertStatus(response.status, 401, 'refresh using rotated old token');
        logSuccess('old refresh token rejected');
    }

    logStep('11. Update account A credentials');
    {
        const { response } = await request(CREDENTIALS_UPDATE_PATH, {
            method: 'POST',
            accessToken: refreshPayload.accessToken,
            body: {
                currentSecret: password,
                newSecret: updatedSecret,
            },
        });

        assertStatus(response.status, 204, 'update account A credentials');
        logSuccess('credentials updated');
    }

    logStep('12. Active refresh token must be rejected after credentials update');
    {
        const { response } = await request('/api/v1/auth/refresh', {
            method: 'POST',
            body: {
                refreshToken: refreshPayload.refreshToken,
            },
        });

        assertStatus(response.status, 401, 'refresh after credentials update');
        logSuccess('active refresh token revoked after credentials update');
    }

    logStep('13. Login with old credentials must fail');
    {
        const { response } = await request('/api/v1/auth/login', {
            method: 'POST',
            body: {
                email: accountA.email,
                password,
            },
        });

        assertStatus(response.status, 401, 'login account A with old credentials');
        logSuccess('old credentials rejected');
    }

    logStep('14. Login with new credentials must succeed');
    const accountANewLogin = await loginUser(accountA.email, updatedSecret);
    logSuccess('new credentials accepted');

    logStep('15. Logout account A and verify refresh token is revoked');
    {
        const { response } = await request('/api/v1/auth/logout', {
            method: 'POST',
            body: {
                refreshToken: accountANewLogin.refreshToken,
            },
        });

        assertStatus(response.status, 204, 'logout account A');
        logSuccess('logout returned 204');
    }

    logStep('16. Refresh after logout must be rejected');
    {
        const { response } = await request('/api/v1/auth/refresh', {
            method: 'POST',
            body: {
                refreshToken: accountANewLogin.refreshToken,
            },
        });

        assertStatus(response.status, 401, 'refresh after logout');
        logSuccess('revoked refresh token rejected');
    }

    console.log('\n[smoke-auth] SUCCESS: full auth flow works');
}

run().catch((error) => {
    console.error('\n[smoke-auth] FAILED');
    console.error(error);
    process.exitCode = 1;
});

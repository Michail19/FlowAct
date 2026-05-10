import { getDevAuthHeaders, isDevAuthEnabled } from './devAuthStub';
import { getAuthSession } from './authSession';

export function applyAuthHeaders(headers: Headers) {
    const session = getAuthSession();

    if (session.accessToken && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${session.accessToken}`);
    }

    // Временная dev-заглушка до подключения UserService/AuthService.
    // После появления настоящей авторизации этот блок можно будет удалить,
    // не меняя остальные API-сервисы.
    if (isDevAuthEnabled()) {
        const devHeaders = getDevAuthHeaders();

        Object.entries(devHeaders).forEach(([key, value]) => {
            if (!headers.has(key)) {
                headers.set(key, value);
            }
        });
    }
}

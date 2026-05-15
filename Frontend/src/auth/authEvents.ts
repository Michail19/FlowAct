const AUTH_SESSION_ENDED_EVENT = 'flowact:auth-session-ended';
const AUTH_SESSION_MESSAGE_KEY = 'flowact-auth-session-message';

export function notifyAuthSessionEnded(message = 'Сессия завершена. Войдите снова.') {
    sessionStorage.setItem(AUTH_SESSION_MESSAGE_KEY, message);
    window.dispatchEvent(new CustomEvent(AUTH_SESSION_ENDED_EVENT, {
        detail: { message },
    }));
}

export function subscribeAuthSessionEnded(listener: () => void) {
    window.addEventListener(AUTH_SESSION_ENDED_EVENT, listener);

    return () => {
        window.removeEventListener(AUTH_SESSION_ENDED_EVENT, listener);
    };
}

export function consumeAuthSessionMessage() {
    const message = sessionStorage.getItem(AUTH_SESSION_MESSAGE_KEY);
    sessionStorage.removeItem(AUTH_SESSION_MESSAGE_KEY);
    return message;
}

import { ApiError } from './apiClient';
import { isRetryableNotebookSyncError } from './notebookSyncQueue';

export type PersistenceSaveStage = 'notebook' | 'workflow' | 'validation' | 'activation';
export type PersistenceErrorKind =
    | 'auth'
    | 'validation'
    | 'not-found'
    | 'conflict'
    | 'backend-unavailable'
    | 'server'
    | 'unknown';

export class PersistenceError extends Error {
    stage: PersistenceSaveStage;
    kind: PersistenceErrorKind;
    status?: number;
    payload?: unknown;

    constructor(params: {
        stage: PersistenceSaveStage;
        kind: PersistenceErrorKind;
        message: string;
        status?: number;
        payload?: unknown;
        cause?: unknown;
    }) {
        super(params.message);
        this.name = 'PersistenceError';
        this.stage = params.stage;
        this.kind = params.kind;
        this.status = params.status;
        this.payload = params.payload;

        if (params.cause) {
            this.cause = params.cause;
        }
    }
}

function getPayloadMessage(payload: unknown) {
    if (!payload) {
        return null;
    }

    if (typeof payload === 'string') {
        return payload.trim() || null;
    }

    if (typeof payload !== 'object') {
        return null;
    }

    const payloadObject = payload as Record<string, unknown>;
    const message =
        payloadObject.message ??
        payloadObject.error ??
        payloadObject.detail ??
        payloadObject.title;

    return typeof message === 'string' && message.trim()
        ? message
        : null;
}

function getStageLabel(stage: PersistenceSaveStage) {
    switch (stage) {
        case 'notebook':
            return 'notebook';
        case 'workflow':
            return 'workflow';
        case 'validation':
            return 'backend-валидацию';
        case 'activation':
            return 'активацию workflow';
        default:
            return 'данные';
    }
}

export function createPersistenceError(
    stage: PersistenceSaveStage,
    error: unknown,
): PersistenceError {
    const stageLabel = getStageLabel(stage);

    if (isRetryableNotebookSyncError(error)) {
        return new PersistenceError({
            stage,
            kind: 'backend-unavailable',
            message:
                `Backend временно недоступен. ${stageLabel} сохранён локально ` +
                'и будет синхронизирован автоматически позже.',
            cause: error,
        });
    }

    if (error instanceof ApiError) {
        const payloadMessage = getPayloadMessage(error.payload);

        if (error.status === 401 || error.status === 403) {
            return new PersistenceError({
                stage,
                kind: 'auth',
                status: error.status,
                payload: error.payload,
                message:
                    'Сессия недействительна или у пользователя нет прав на сохранение. ' +
                    'Войдите заново и повторите действие.',
                cause: error,
            });
        }

        if (error.status === 400) {
            return new PersistenceError({
                stage,
                kind: 'validation',
                status: error.status,
                payload: error.payload,
                message:
                    payloadMessage ??
                    `Backend отклонил данные ${stageLabel}. Проверьте структуру блоков и связей.`,
                cause: error,
            });
        }

        if (error.status === 404) {
            return new PersistenceError({
                stage,
                kind: 'not-found',
                status: error.status,
                payload: error.payload,
                message:
                    payloadMessage ??
                    `${stageLabel} не найден на backend. Обновите страницу или создайте notebook заново.`,
                cause: error,
            });
        }

        if (error.status === 409) {
            return new PersistenceError({
                stage,
                kind: 'conflict',
                status: error.status,
                payload: error.payload,
                message:
                    payloadMessage ??
                    `Конфликт состояния при сохранении ${stageLabel}. Обновите данные и повторите сохранение.`,
                cause: error,
            });
        }

        if (error.status >= 500) {
            return new PersistenceError({
                stage,
                kind: 'server',
                status: error.status,
                payload: error.payload,
                message:
                    payloadMessage ??
                    `Backend вернул внутреннюю ошибку при сохранении ${stageLabel}.`,
                cause: error,
            });
        }

        return new PersistenceError({
            stage,
            kind: 'unknown',
            status: error.status,
            payload: error.payload,
            message:
                payloadMessage ??
                `Не удалось сохранить ${stageLabel}: HTTP ${error.status}.`,
            cause: error,
        });
    }

    if (error instanceof Error) {
        return new PersistenceError({
            stage,
            kind: 'unknown',
            message: error.message,
            cause: error,
        });
    }

    return new PersistenceError({
        stage,
        kind: 'unknown',
        message: `Не удалось сохранить ${stageLabel}.`,
        cause: error,
    });
}

export function createWorkflowAfterNotebookSaveError(error: unknown) {
    const persistenceError = createPersistenceError('workflow', error);

    return new PersistenceError({
        stage: 'workflow',
        kind: persistenceError.kind,
        status: persistenceError.status,
        payload: persistenceError.payload,
        message:
            'Notebook сохранён, но workflow сохранить не удалось. ' +
            persistenceError.message,
        cause: persistenceError,
    });
}

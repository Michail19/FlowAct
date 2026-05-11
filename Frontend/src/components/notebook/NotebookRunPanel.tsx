import { useState } from 'react';

import NotebookSvgIcon from './NotebookSvgIcon';

import type {
    NotebookExecutionLog,
    WorkflowExecutionResult,
    WorkflowExecutionStatus,
} from './executionTypes';

import './NotebookRunPanel.css';

type RunPanelTab = 'logs' | 'result';

type NotebookRunPanelProps = {
    isOpen: boolean;
    status: WorkflowExecutionStatus;
    logs: NotebookExecutionLog[];
    result: WorkflowExecutionResult | null;
    isMobile: boolean;
    onClose: () => void;
    onClear: () => void;
    onRunWorkflow: () => void;

    canCancel?: boolean;
    canRetry?: boolean;
    canResume?: boolean;
    isExecutionActionPending?: boolean;
    onCancelExecution?: () => void;
    onRetryExecution?: () => void;
    onResumeExecution?: () => void;
};

const statusLabels: Record<WorkflowExecutionStatus, string> = {
    idle: 'Ожидает запуска',
    created: 'Создано',
    validating: 'Проверяется',
    pending: 'В очереди',
    ready: 'Готово к запуску',
    running: 'Выполняется',
    waiting: 'Ожидает события',
    success: 'Выполнено',
    error: 'Ошибка',
    cancelling: 'Отменяется',
    cancelled: 'Отменено',
    skipped: 'Пропущено',
};

function formatLogTime(date: string) {
    return new Date(date).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

function formatDateTime(date: string) {
    return new Date(date).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

function formatDuration(durationMs: number) {
    if (durationMs < 1000) {
        return `${durationMs} мс`;
    }

    return `${(durationMs / 1000).toFixed(1)} сек.`;
}

function NotebookRunPanel({
                              isOpen,
                              status,
                              logs,
                              result,
                              isMobile,
                              onClose,
                              onClear,
                              onRunWorkflow,
                              canCancel = false,
                              canRetry = false,
                              canResume = false,
                              isExecutionActionPending = false,
                              onCancelExecution,
                              onRetryExecution,
                              onResumeExecution,
                          }: NotebookRunPanelProps) {
    const [activeTab, setActiveTab] = useState<RunPanelTab>('logs');
    const [isTechnicalOutputOpen, setIsTechnicalOutputOpen] = useState(false);

    if (!isOpen) {
        return null;
    }

    const panelClassName = isMobile
        ? 'notebook-run-panel notebook-run-panel--mobile'
        : 'notebook-run-panel';

    return (
        <aside className={panelClassName}>
            <header className="notebook-run-panel__header">
                <div>
                    <h2 className="notebook-run-panel__title">Выполнение</h2>
                    <span className={`notebook-run-panel__status notebook-run-panel__status--${status}`}>
                        {statusLabels[status]}
                    </span>
                </div>

                <button
                    className="notebook-run-panel__close"
                    type="button"
                    aria-label="Закрыть панель выполнения"
                    onClick={onClose}
                >
                    <NotebookSvgIcon name="close" size={16} />
                </button>
            </header>

            <div className="notebook-run-panel__tabs">
                <button
                    className={
                        activeTab === 'logs'
                            ? 'notebook-run-panel__tab notebook-run-panel__tab--active'
                            : 'notebook-run-panel__tab'
                    }
                    type="button"
                    onClick={() => setActiveTab('logs')}
                >
                    Логи
                </button>

                <button
                    className={
                        activeTab === 'result'
                            ? 'notebook-run-panel__tab notebook-run-panel__tab--active'
                            : 'notebook-run-panel__tab'
                    }
                    type="button"
                    onClick={() => setActiveTab('result')}
                >
                    Результат
                </button>
            </div>

            <div className="notebook-run-panel__actions">
                <button
                    className="notebook-run-panel__button notebook-run-panel__button--run"
                    type="button"
                    onClick={onRunWorkflow}
                    disabled={status === 'running' || isExecutionActionPending}
                >
                    {status === 'running' ? 'Выполняется...' : 'Запустить'}
                </button>

                {canCancel && (
                    <button
                        className="notebook-run-panel__button notebook-run-panel__button--cancel"
                        type="button"
                        onClick={onCancelExecution}
                        disabled={isExecutionActionPending}
                    >
                        {isExecutionActionPending ? 'Отмена...' : 'Отменить'}
                    </button>
                )}

                {canResume && (
                    <button
                        className="notebook-run-panel__button notebook-run-panel__button--resume"
                        type="button"
                        onClick={onResumeExecution}
                        disabled={isExecutionActionPending}
                    >
                        {isExecutionActionPending ? 'Продолжение...' : 'Продолжить'}
                    </button>
                )}

                {canRetry && (
                    <button
                        className="notebook-run-panel__button notebook-run-panel__button--retry"
                        type="button"
                        onClick={onRetryExecution}
                        disabled={isExecutionActionPending}
                    >
                        {isExecutionActionPending ? 'Повтор...' : 'Повторить'}
                    </button>
                )}

                <button
                    className="notebook-run-panel__button notebook-run-panel__button--clear"
                    type="button"
                    onClick={onClear}
                    disabled={(logs.length === 0 && !result) || status === 'running'}
                >
                    Очистить
                </button>
            </div>

            {activeTab === 'logs' && (
                <div className="notebook-run-panel__logs">
                    {logs.length === 0 ? (
                        <p className="notebook-run-panel__empty">
                            Логи появятся после запуска рабочего процесса.
                        </p>
                    ) : (
                        logs.map((log) => (
                            <article
                                className={`notebook-run-panel__log notebook-run-panel__log--${log.level}`}
                                key={log.id}
                            >
                                <div className="notebook-run-panel__log-header">
                                    <span className="notebook-run-panel__log-time">
                                        {formatLogTime(log.createdAt)}
                                    </span>

                                    {log.blockTitle && (
                                        <strong className="notebook-run-panel__log-block">
                                            {log.blockTitle}
                                        </strong>
                                    )}
                                </div>

                                <p className="notebook-run-panel__log-message">
                                    {log.message}
                                </p>
                            </article>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'result' && (
                <div className="notebook-run-panel__result">
                    {!result ? (
                        <p className="notebook-run-panel__empty">
                            Результат появится после завершения рабочего процесса.
                        </p>
                    ) : (
                        <>
                            <div className={`notebook-run-panel__result-card notebook-run-panel__result-card--${result.status}`}>
                                <span className="notebook-run-panel__result-label">
                                    Итог
                                </span>
                                <strong className="notebook-run-panel__result-title">
                                    {result.summary}
                                </strong>
                                <div className="notebook-run-panel__result-output">
                                    {result.output}
                                </div>

                                {result.rawOutput && result.rawOutput !== result.output && (
                                    <div className="notebook-run-panel__technical">
                                        <button
                                            className="notebook-run-panel__technical-toggle"
                                            type="button"
                                            onClick={() =>
                                                setIsTechnicalOutputOpen((currentValue) => !currentValue)
                                            }
                                        >
                                            {isTechnicalOutputOpen
                                                ? 'Скрыть технические данные'
                                                : 'Показать технические данные'}
                                        </button>

                                        {isTechnicalOutputOpen && (
                                            <pre className="notebook-run-panel__technical-json">
                                                {result.rawOutput}
                                            </pre>
                                        )}
                                    </div>
                                )}
                            </div>

                            <dl className="notebook-run-panel__metrics">
                                <div className="notebook-run-panel__metric">
                                    <dt>Блоков всего</dt>
                                    <dd>{result.totalBlocks}</dd>
                                </div>

                                <div className="notebook-run-panel__metric">
                                    <dt>Выполнено</dt>
                                    <dd>{result.completedBlocks}</dd>
                                </div>

                                <div className="notebook-run-panel__metric">
                                    <dt>Ошибок</dt>
                                    <dd>{result.errorsCount}</dd>
                                </div>

                                <div className="notebook-run-panel__metric">
                                    <dt>Предупреждений</dt>
                                    <dd>{result.warningsCount}</dd>
                                </div>

                                <div className="notebook-run-panel__metric">
                                    <dt>Длительность</dt>
                                    <dd>{formatDuration(result.durationMs)}</dd>
                                </div>

                                <div className="notebook-run-panel__metric">
                                    <dt>Завершено</dt>
                                    <dd>{formatDateTime(result.finishedAt)}</dd>
                                </div>
                            </dl>
                        </>
                    )}
                </div>
            )}
        </aside>
    );
}

export default NotebookRunPanel;

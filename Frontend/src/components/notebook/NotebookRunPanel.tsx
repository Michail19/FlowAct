import type {
    NotebookExecutionLog,
    WorkflowExecutionStatus,
} from './executionTypes';

import './NotebookRunPanel.css';

type NotebookRunPanelProps = {
    isOpen: boolean;
    status: WorkflowExecutionStatus;
    logs: NotebookExecutionLog[];
    isMobile: boolean;
    onClose: () => void;
    onClear: () => void;
    onRunWorkflow: () => void;
};

const statusLabels: Record<WorkflowExecutionStatus, string> = {
    idle: 'Ожидает запуска',
    running: 'Выполняется',
    success: 'Выполнено',
    error: 'Ошибка',
};

function formatLogTime(date: string) {
    return new Date(date).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

function NotebookRunPanel({
                              isOpen,
                              status,
                              logs,
                              isMobile,
                              onClose,
                              onClear,
                              onRunWorkflow,
                          }: NotebookRunPanelProps) {
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
                    ×
                </button>
            </header>

            <div className="notebook-run-panel__actions">
                <button
                    className="notebook-run-panel__button notebook-run-panel__button--run"
                    type="button"
                    onClick={onRunWorkflow}
                    disabled={status === 'running'}
                >
                    {status === 'running' ? 'Выполняется...' : 'Запустить'}
                </button>

                <button
                    className="notebook-run-panel__button notebook-run-panel__button--clear"
                    type="button"
                    onClick={onClear}
                    disabled={logs.length === 0 || status === 'running'}
                >
                    Очистить
                </button>
            </div>

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
        </aside>
    );
}

export default NotebookRunPanel;

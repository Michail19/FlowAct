import { useMemo, useState } from 'react';

import type {
    NotebookBlockInspectionTarget,
    NotebookExecutionLog,
} from './executionTypes';
import NotebookSvgIcon from './NotebookSvgIcon';

import './NotebookBlockInspector.css';

type NotebookBlockInspectorProps = {
    block: NotebookBlockInspectionTarget | null;
    logs: NotebookExecutionLog[];
    isMobile: boolean;
    onClose: () => void;
};

const blockTypeLabels: Record<string, string> = {
    start: 'Старт',
    end: 'Конец',
    ai: 'AI-функция',
    condition: 'Условие',
    action: 'Действие',
    database: 'База данных',
    email: 'Email',
    log: 'Логирование',
    http: 'HTTP-запрос',
    loop: 'Цикл',
    merge: 'Объединение',
};

function getBlockTypeLabel(blockType: string) {
    return blockTypeLabels[blockType] ?? blockType;
}

function getStatusLabel(status: string) {
    switch (status) {
        case 'idle':
            return 'Не выполнялся';
        case 'pending':
            return 'Ожидает';
        case 'running':
            return 'Выполняется';
        case 'success':
            return 'Успешно';
        case 'error':
            return 'Ошибка';
        case 'skipped':
            return 'Пропущен';
        case 'waiting':
            return 'Ожидает события';
        default:
            return status;
    }
}

function getLatestLog(logs: NotebookExecutionLog[]) {
    if (logs.length === 0) {
        return null;
    }

    return logs[logs.length - 1];
}

function NotebookBlockInspector({
                                    block,
                                    logs,
                                    isMobile,
                                    onClose,
                                }: NotebookBlockInspectorProps) {
    const [isRawInputOpen, setIsRawInputOpen] = useState(false);
    const [isRawOutputOpen, setIsRawOutputOpen] = useState(false);

    const blockLogs = useMemo(() => {
        if (!block) {
            return [];
        }

        return logs.filter((log) => log.blockId === block.blockId);
    }, [block, logs]);

    const latestLog = getLatestLog(blockLogs);

    if (!block) {
        return null;
    }

    return (
        <aside
            className={
                isMobile
                    ? 'notebook-block-inspector notebook-block-inspector--mobile'
                    : 'notebook-block-inspector'
            }
        >
            <header className="notebook-block-inspector__header">
                <div>
                    <span className="notebook-block-inspector__eyebrow">
                        Инспектор блока
                    </span>
                    <h2 className="notebook-block-inspector__title">
                        {block.blockTitle}
                    </h2>
                    <p className="notebook-block-inspector__subtitle">
                        {getBlockTypeLabel(block.blockType)}
                    </p>
                </div>

                <button
                    className="notebook-block-inspector__close"
                    type="button"
                    aria-label="Закрыть инспектор блока"
                    onClick={onClose}
                >
                    <NotebookSvgIcon name="close" size={16} />
                </button>
            </header>

            <div className="notebook-block-inspector__status-row">
                <span
                    className={`notebook-block-inspector__status notebook-block-inspector__status--${block.blockStatus}`}
                >
                    {getStatusLabel(block.blockStatus)}
                </span>

                <span className="notebook-block-inspector__logs-count">
                    Логов: {blockLogs.length}
                </span>
            </div>

            {!latestLog ? (
                <p className="notebook-block-inspector__empty">
                    У этого блока пока нет данных выполнения. Запустите рабочий
                    процесс, чтобы увидеть входные и выходные данные.
                </p>
            ) : (
                <>
                    {latestLog.error && (
                        <section className="notebook-block-inspector__section notebook-block-inspector__section--error">
                            <h3>Ошибка</h3>
                            <div className="notebook-block-inspector__content">
                                {latestLog.error}
                            </div>
                        </section>
                    )}

                    <section className="notebook-block-inspector__section">
                        <h3>Входные данные</h3>

                        {latestLog.input ? (
                            <div className="notebook-block-inspector__content">
                                {latestLog.input}
                            </div>
                        ) : (
                            <p className="notebook-block-inspector__empty-small">
                                Входные данные не сохранены или отсутствуют.
                            </p>
                        )}

                        {latestLog.rawInput && latestLog.rawInput !== latestLog.input && (
                            <div className="notebook-block-inspector__raw">
                                <button
                                    className="notebook-block-inspector__raw-toggle"
                                    type="button"
                                    onClick={() =>
                                        setIsRawInputOpen((currentValue) => !currentValue)
                                    }
                                >
                                    {isRawInputOpen
                                        ? 'Скрыть raw input'
                                        : 'Показать raw input'}
                                </button>

                                {isRawInputOpen && (
                                    <pre className="notebook-block-inspector__json">
                                        {latestLog.rawInput}
                                    </pre>
                                )}
                            </div>
                        )}
                    </section>

                    <section className="notebook-block-inspector__section">
                        <h3>Выходные данные</h3>

                        {latestLog.output ? (
                            <div className="notebook-block-inspector__content">
                                {latestLog.output}
                            </div>
                        ) : (
                            <p className="notebook-block-inspector__empty-small">
                                Выходные данные отсутствуют.
                            </p>
                        )}

                        {latestLog.rawOutput && latestLog.rawOutput !== latestLog.output && (
                            <div className="notebook-block-inspector__raw">
                                <button
                                    className="notebook-block-inspector__raw-toggle"
                                    type="button"
                                    onClick={() =>
                                        setIsRawOutputOpen((currentValue) => !currentValue)
                                    }
                                >
                                    {isRawOutputOpen
                                        ? 'Скрыть raw output'
                                        : 'Показать raw output'}
                                </button>

                                {isRawOutputOpen && (
                                    <pre className="notebook-block-inspector__json">
                                        {latestLog.rawOutput}
                                    </pre>
                                )}
                            </div>
                        )}
                    </section>
                </>
            )}
        </aside>
    );
}

export default NotebookBlockInspector;

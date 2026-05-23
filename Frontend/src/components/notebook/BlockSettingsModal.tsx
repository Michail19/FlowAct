import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import type {
    ActionBlockConfig,
    ConditionBlockConfig,
    DatabaseBlockConfig,
    EmailBlockConfig,
    HttpBlockConfig,
    LogBlockConfig,
    LoopBlockConfig,
    MergeBlockConfig,
    NotebookBlockConfig,
    NotebookBlockType,
} from './notebookTypes';
import { getBlockSettingsHelp } from './blockSettingsHelp';

import './BlockSettingsModal.css';

export type BlockSettingsPayload = {
    title: string;
    subtitle: string;
    description: string;
    config?: NotebookBlockConfig;
};

type BlockSettingsModalProps = {
    blockType: NotebookBlockType;
    initialTitle: string;
    initialSubtitle?: string;
    initialDescription?: string;
    initialConfig?: NotebookBlockConfig;
    onSave: (settings: BlockSettingsPayload) => void;
    onClose: () => void;
};

const conditionOperatorLabels: Record<ConditionBlockConfig['operator'], string> = {
    equals: 'равно',
    notEquals: 'не равно',
    contains: 'содержит',
    greaterThan: 'больше',
    lessThan: 'меньше',
    exists: 'существует',
};

function getDefaultConditionConfig(config?: NotebookBlockConfig): ConditionBlockConfig {
    return {
        leftValue: config?.condition?.leftValue ?? 'value.status',
        operator: config?.condition?.operator ?? 'equals',
        rightValue: config?.condition?.rightValue ?? '200',
    };
}

function getDefaultActionConfig(config?: NotebookBlockConfig): ActionBlockConfig {
    return {
        actionType: config?.action?.actionType ?? 'transform',
        parameters:
            config?.action?.parameters ??
            '{\n  "text": "{{value.text}}",\n  "status": "processed"\n}',
    };
}

function getDefaultDatabaseConfig(config?: NotebookBlockConfig): DatabaseBlockConfig {
    return {
        operation: config?.database?.operation ?? 'select',
        tableName: config?.database?.tableName ?? '',
        query: config?.database?.query ?? 'SELECT * FROM execution_results WHERE status = :status',
        payload: config?.database?.payload ?? '{\n  "status": "{{value.status}}"\n}',
    };
}

function getDefaultEmailConfig(config?: NotebookBlockConfig): EmailBlockConfig {
    return {
        recipient: config?.email?.recipient ?? '',
        subject: config?.email?.subject ?? 'Результат workflow: {{value.status}}',
        body:
            config?.email?.body ??
            'Workflow завершён.\n\nКраткий результат:\n{{value.text}}\n\nПолные данные:\n{{value}}',
    };
}

function getDefaultLogConfig(config?: NotebookBlockConfig): LogBlockConfig {
    return {
        level: config?.log?.level ?? 'info',
        messageTemplate: config?.log?.messageTemplate ?? 'Результат блока: {{value}}',
    };
}

function getDefaultHttpConfig(config?: NotebookBlockConfig): HttpBlockConfig {
    return {
        method: config?.http?.method ?? 'GET',
        url: config?.http?.url ?? 'https://jsonplaceholder.typicode.com/posts/1',
        headers: config?.http?.headers ?? '{\n  "Accept": "application/json"\n}',
        body: config?.http?.body ?? '{\n  "text": "{{value.text}}",\n  "source": "FlowAct"\n}',
        timeoutMs: config?.http?.timeoutMs ?? 10000,
        maxResponseChars: config?.http?.maxResponseChars ?? 50000,
        responseMode: config?.http?.responseMode ?? 'auto',
        continueOnError: config?.http?.continueOnError ?? false,
    };
}

function getDefaultLoopConfig(config?: NotebookBlockConfig): LoopBlockConfig {
    return {
        collectionPath: config?.loop?.collectionPath ?? 'value.items',
        itemName: config?.loop?.itemName ?? 'item',
        mode: config?.loop?.mode ?? 'map',
    };
}

function getDefaultMergeConfig(config?: NotebookBlockConfig): MergeBlockConfig {
    return {
        mode: config?.merge?.mode ?? 'combine',
    };
}

function parseConditionTemplate(template: string): ConditionBlockConfig | null {
    const [leftValue, operator, ...rightParts] = template.trim().split(/\s+/);

    if (!leftValue || !operator || !(operator in conditionOperatorLabels)) {
        return null;
    }

    return {
        leftValue,
        operator: operator as ConditionBlockConfig['operator'],
        rightValue: rightParts.join(' '),
    };
}

function BlockHelpPanel({
    blockType,
    onApplyTemplate,
}: {
    blockType: NotebookBlockType;
    onApplyTemplate: (template: string) => void;
}) {
    const help = getBlockSettingsHelp(blockType);

    return (
        <section className="block-settings-modal__help">
            <div className="block-settings-modal__help-main">
                <span className="block-settings-modal__help-badge">
                    Backend: {help.backendType}
                </span>
                <p>{help.summary}</p>
            </div>

            <div className="block-settings-modal__help-grid">
                <div>
                    <strong>Вход</strong>
                    <p>{help.input}</p>
                </div>
                <div>
                    <strong>Выход</strong>
                    <p>{help.output}</p>
                </div>
            </div>

            <details className="block-settings-modal__details">
                <summary>Переменные и готовые шаблоны</summary>

                <div className="block-settings-modal__details-content">
                    <div>
                        <span className="block-settings-modal__details-title">
                            Что можно использовать
                        </span>
                        <ul className="block-settings-modal__help-list">
                            {help.variables.map((variable) => (
                                <li key={variable}>{variable}</li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <span className="block-settings-modal__details-title">
                            Шаблоны для быстрого старта
                        </span>
                        <div className="block-settings-modal__template-list">
                            {help.templates.map((template) => (
                                <button
                                    className="block-settings-modal__template-button"
                                    type="button"
                                    key={template}
                                    onClick={() => onApplyTemplate(template)}
                                >
                                    <code>{template}</code>
                                </button>
                            ))}
                        </div>
                    </div>

                    {help.notes && help.notes.length > 0 && (
                        <div>
                            <span className="block-settings-modal__details-title">
                                Важно
                            </span>
                            <ul className="block-settings-modal__help-list">
                                {help.notes.map((note) => (
                                    <li key={note}>{note}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </details>
        </section>
    );
}

function BlockSettingsModal({
    blockType,
    initialTitle,
    initialSubtitle = '',
    initialDescription = '',
    initialConfig,
    onSave,
    onClose,
}: BlockSettingsModalProps) {
    const help = getBlockSettingsHelp(blockType);
    const [title, setTitle] = useState(initialTitle);
    const [subtitle, setSubtitle] = useState(initialSubtitle);
    const [description, setDescription] = useState(initialDescription || help.summary);

    const [conditionConfig, setConditionConfig] = useState<ConditionBlockConfig>(() =>
        getDefaultConditionConfig(initialConfig),
    );
    const [actionConfig, setActionConfig] = useState<ActionBlockConfig>(() =>
        getDefaultActionConfig(initialConfig),
    );
    const [databaseConfig, setDatabaseConfig] = useState<DatabaseBlockConfig>(() =>
        getDefaultDatabaseConfig(initialConfig),
    );
    const [emailConfig, setEmailConfig] = useState<EmailBlockConfig>(() =>
        getDefaultEmailConfig(initialConfig),
    );
    const [logConfig, setLogConfig] = useState<LogBlockConfig>(() =>
        getDefaultLogConfig(initialConfig),
    );
    const [httpConfig, setHttpConfig] = useState<HttpBlockConfig>(() =>
        getDefaultHttpConfig(initialConfig),
    );
    const [loopConfig, setLoopConfig] = useState<LoopBlockConfig>(() =>
        getDefaultLoopConfig(initialConfig),
    );
    const [mergeConfig, setMergeConfig] = useState<MergeBlockConfig>(() =>
        getDefaultMergeConfig(initialConfig),
    );

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    const getConfigByBlockType = (): NotebookBlockConfig | undefined => {
        if (blockType === 'condition') {
            return { condition: conditionConfig };
        }

        if (blockType === 'action') {
            return { action: actionConfig };
        }

        if (blockType === 'database') {
            return { database: databaseConfig };
        }

        if (blockType === 'email') {
            return { email: emailConfig };
        }

        if (blockType === 'log') {
            return { log: logConfig };
        }

        if (blockType === 'http') {
            return { http: httpConfig };
        }

        if (blockType === 'loop') {
            return { loop: loopConfig };
        }

        if (blockType === 'merge') {
            return { merge: mergeConfig };
        }

        return undefined;
    };

    const getEffectiveSubtitle = () => {
        if (blockType === 'http') {
            return `${httpConfig.method} ${httpConfig.url}`.trim();
        }

        return subtitle.trim() || help.input;
    };

    const handleApplyTemplate = (template: string) => {
        if (blockType === 'condition') {
            const conditionTemplate = parseConditionTemplate(template);

            if (conditionTemplate) {
                setConditionConfig(conditionTemplate);
            }
            return;
        }

        if (blockType === 'action') {
            setActionConfig((currentConfig) => ({
                ...currentConfig,
                parameters: template,
            }));
            return;
        }

        if (blockType === 'database') {
            if (template.trim().toUpperCase().startsWith('SELECT') ||
                template.trim().toUpperCase().startsWith('INSERT') ||
                template.trim().toUpperCase().startsWith('UPDATE') ||
                template.trim().toUpperCase().startsWith('DELETE')) {
                setDatabaseConfig((currentConfig) => ({
                    ...currentConfig,
                    query: template,
                }));
            } else {
                setDatabaseConfig((currentConfig) => ({
                    ...currentConfig,
                    payload: template,
                }));
            }
            return;
        }

        if (blockType === 'email') {
            setEmailConfig((currentConfig) => ({
                ...currentConfig,
                body: template,
            }));
            return;
        }

        if (blockType === 'log') {
            setLogConfig((currentConfig) => ({
                ...currentConfig,
                messageTemplate: template,
            }));
            return;
        }

        if (blockType === 'http') {
            if (template.startsWith('http')) {
                setHttpConfig((currentConfig) => ({
                    ...currentConfig,
                    url: template,
                }));
            } else if (template.includes('Accept') || template.includes('Content-Type')) {
                setHttpConfig((currentConfig) => ({
                    ...currentConfig,
                    headers: template,
                }));
            } else {
                setHttpConfig((currentConfig) => ({
                    ...currentConfig,
                    body: template,
                }));
            }
            return;
        }

        if (blockType === 'loop') {
            setLoopConfig((currentConfig) => ({
                ...currentConfig,
                collectionPath: template,
            }));
        }
    };

    const handleSave = () => {
        onSave({
            title: title.trim() || 'Блок',
            subtitle: getEffectiveSubtitle(),
            description: description.trim() || help.summary,
            config: getConfigByBlockType(),
        });
    };

    const shouldShowSubtitleField = blockType !== 'http';
    const shouldShowDescriptionField = blockType !== 'http';

    return createPortal(
        <div
            className="block-settings-modal"
            role="dialog"
            aria-modal="true"
            onPointerDown={(event) => event.stopPropagation()}
        >
            <div className="block-settings-modal__content">
                <header className="block-settings-modal__header">
                    <h2 className="block-settings-modal__title">Настройки блока</h2>
                    <button className="block-settings-modal__close" type="button" onClick={onClose}>
                        ×
                    </button>
                </header>

                <div className="block-settings-modal__body">
                    <BlockHelpPanel blockType={blockType} onApplyTemplate={handleApplyTemplate} />

                    <label className="block-settings-modal__field">
                        <span className="block-settings-modal__label">Название</span>
                        <input
                            className="block-settings-modal__input"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Название блока"
                        />
                    </label>

                    {shouldShowSubtitleField && (
                        <label className="block-settings-modal__field">
                            <span className="block-settings-modal__label">Краткое описание на карточке</span>
                            <input
                                className="block-settings-modal__input"
                                value={subtitle}
                                onChange={(event) => setSubtitle(event.target.value)}
                                placeholder={help.input}
                            />
                        </label>
                    )}

                    {shouldShowDescriptionField && (
                        <label className="block-settings-modal__field">
                            <span className="block-settings-modal__label">Описание блока</span>
                            <textarea
                                className="block-settings-modal__textarea"
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                placeholder={help.summary}
                            />
                        </label>
                    )}

                    {blockType === 'condition' && (
                        <section className="block-settings-modal__type-section">
                            <h3 className="block-settings-modal__section-title">Условие</h3>

                            <div className="block-settings-modal__grid">
                                <label className="block-settings-modal__field">
                                    <span className="block-settings-modal__label">Путь к проверяемому значению</span>
                                    <input
                                        className="block-settings-modal__input"
                                        value={conditionConfig.leftValue}
                                        onChange={(event) =>
                                            setConditionConfig((currentConfig) => ({
                                                ...currentConfig,
                                                leftValue: event.target.value,
                                            }))
                                        }
                                        placeholder="value.status"
                                    />
                                </label>

                                <label className="block-settings-modal__field">
                                    <span className="block-settings-modal__label">Оператор</span>
                                    <select
                                        className="block-settings-modal__input"
                                        value={conditionConfig.operator}
                                        onChange={(event) =>
                                            setConditionConfig((currentConfig) => ({
                                                ...currentConfig,
                                                operator: event.target.value as ConditionBlockConfig['operator'],
                                            }))
                                        }
                                    >
                                        {Object.entries(conditionOperatorLabels).map(([value, label]) => (
                                            <option value={value} key={value}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block-settings-modal__field">
                                    <span className="block-settings-modal__label">Ожидаемое значение</span>
                                    <input
                                        className="block-settings-modal__input"
                                        value={conditionConfig.rightValue}
                                        onChange={(event) =>
                                            setConditionConfig((currentConfig) => ({
                                                ...currentConfig,
                                                rightValue: event.target.value,
                                            }))
                                        }
                                        placeholder="success"
                                    />
                                </label>
                            </div>

                            <p className="block-settings-modal__hint">
                                Путь указывается без фигурных скобок: <code>value.status</code>,
                                <code>value.body.type</code>, <code>input.type</code>,
                                <code>variables.mode</code>.
                            </p>
                        </section>
                    )}

                    {blockType === 'action' && (
                        <section className="block-settings-modal__type-section">
                            <h3 className="block-settings-modal__section-title">Действие</h3>

                            <label className="block-settings-modal__field">
                                <span className="block-settings-modal__label">Тип действия</span>
                                <select
                                    className="block-settings-modal__input"
                                    value={actionConfig.actionType}
                                    onChange={(event) =>
                                        setActionConfig((currentConfig) => ({
                                            ...currentConfig,
                                            actionType: event.target.value as ActionBlockConfig['actionType'],
                                        }))
                                    }
                                >
                                    <option value="format">Форматирование</option>
                                    <option value="transform">Преобразование</option>
                                    <option value="custom">Пользовательское действие</option>
                                </select>
                            </label>

                            <label className="block-settings-modal__field">
                                <span className="block-settings-modal__label">Parameters JSON / текст</span>
                                <textarea
                                    className="block-settings-modal__textarea"
                                    value={actionConfig.parameters}
                                    onChange={(event) =>
                                        setActionConfig((currentConfig) => ({
                                            ...currentConfig,
                                            parameters: event.target.value,
                                        }))
                                    }
                                    placeholder='{"text": "{{value.text}}"}'
                                />
                            </label>
                        </section>
                    )}

                    {blockType === 'database' && (
                        <section className="block-settings-modal__type-section">
                            <h3 className="block-settings-modal__section-title">База данных</h3>

                            <div className="block-settings-modal__grid">
                                <label className="block-settings-modal__field">
                                    <span className="block-settings-modal__label">Операция</span>
                                    <select
                                        className="block-settings-modal__input"
                                        value={databaseConfig.operation}
                                        onChange={(event) =>
                                            setDatabaseConfig((currentConfig) => ({
                                                ...currentConfig,
                                                operation: event.target.value as DatabaseBlockConfig['operation'],
                                            }))
                                        }
                                    >
                                        <option value="select">SELECT</option>
                                        <option value="insert">INSERT</option>
                                        <option value="update">UPDATE</option>
                                        <option value="delete">DELETE</option>
                                    </select>
                                </label>

                                <label className="block-settings-modal__field">
                                    <span className="block-settings-modal__label">Таблица, если query пустой</span>
                                    <input
                                        className="block-settings-modal__input"
                                        value={databaseConfig.tableName}
                                        onChange={(event) =>
                                            setDatabaseConfig((currentConfig) => ({
                                                ...currentConfig,
                                                tableName: event.target.value,
                                            }))
                                        }
                                        placeholder="execution_results"
                                    />
                                </label>
                            </div>

                            <label className="block-settings-modal__field">
                                <span className="block-settings-modal__label">SQL / запрос</span>
                                <textarea
                                    className="block-settings-modal__textarea"
                                    value={databaseConfig.query}
                                    onChange={(event) =>
                                        setDatabaseConfig((currentConfig) => ({
                                            ...currentConfig,
                                            query: event.target.value,
                                        }))
                                    }
                                    placeholder="SELECT * FROM table WHERE id = :id"
                                />
                            </label>

                            <label className="block-settings-modal__field">
                                <span className="block-settings-modal__label">Payload JSON для SQL-параметров</span>
                                <textarea
                                    className="block-settings-modal__textarea"
                                    value={databaseConfig.payload}
                                    onChange={(event) =>
                                        setDatabaseConfig((currentConfig) => ({
                                            ...currentConfig,
                                            payload: event.target.value,
                                        }))
                                    }
                                    placeholder='{"id": "{{value.id}}"}'
                                />
                            </label>
                        </section>
                    )}

                    {blockType === 'email' && (
                        <section className="block-settings-modal__type-section">
                            <h3 className="block-settings-modal__section-title">Email</h3>

                            <label className="block-settings-modal__field">
                                <span className="block-settings-modal__label">Получатель</span>
                                <input
                                    className="block-settings-modal__input"
                                    value={emailConfig.recipient}
                                    onChange={(event) =>
                                        setEmailConfig((currentConfig) => ({
                                            ...currentConfig,
                                            recipient: event.target.value,
                                        }))
                                    }
                                    placeholder="user@example.com, manager@example.com"
                                />
                            </label>

                            <label className="block-settings-modal__field">
                                <span className="block-settings-modal__label">Тема письма</span>
                                <input
                                    className="block-settings-modal__input"
                                    value={emailConfig.subject}
                                    onChange={(event) =>
                                        setEmailConfig((currentConfig) => ({
                                            ...currentConfig,
                                            subject: event.target.value,
                                        }))
                                    }
                                    placeholder="Результат workflow: {{value.status}}"
                                />
                            </label>

                            <label className="block-settings-modal__field">
                                <span className="block-settings-modal__label">Текст письма</span>
                                <textarea
                                    className="block-settings-modal__textarea"
                                    value={emailConfig.body}
                                    onChange={(event) =>
                                        setEmailConfig((currentConfig) => ({
                                            ...currentConfig,
                                            body: event.target.value,
                                        }))
                                    }
                                    placeholder="Workflow завершён. Результат: {{value}}"
                                />
                            </label>
                        </section>
                    )}

                    {blockType === 'http' && (
                        <section className="block-settings-modal__type-section">
                            <h3 className="block-settings-modal__section-title">
                                Параметры запроса
                            </h3>

                            <div className="block-settings-modal__grid block-settings-modal__grid--http-primary">
                                <label className="block-settings-modal__field">
                                    <span className="block-settings-modal__label">Метод</span>
                                    <select
                                        className="block-settings-modal__input"
                                        value={httpConfig.method}
                                        onChange={(event) =>
                                            setHttpConfig((currentConfig) => ({
                                                ...currentConfig,
                                                method: event.target.value as HttpBlockConfig['method'],
                                            }))
                                        }
                                    >
                                        <option value="GET">GET</option>
                                        <option value="POST">POST</option>
                                        <option value="PUT">PUT</option>
                                        <option value="PATCH">PATCH</option>
                                        <option value="DELETE">DELETE</option>
                                    </select>
                                </label>

                                <label className="block-settings-modal__field">
                                    <span className="block-settings-modal__label">URL</span>
                                    <input
                                        className="block-settings-modal__input"
                                        value={httpConfig.url}
                                        onChange={(event) =>
                                            setHttpConfig((currentConfig) => ({
                                                ...currentConfig,
                                                url: event.target.value,
                                            }))
                                        }
                                        placeholder="https://api.example.com/items/{{value.id}}"
                                    />
                                </label>
                            </div>

                            <div className="block-settings-modal__grid block-settings-modal__grid--http-secondary">
                                <label className="block-settings-modal__field">
                                    <span className="block-settings-modal__label">Режим ответа</span>
                                    <select
                                        className="block-settings-modal__input"
                                        value={httpConfig.responseMode ?? 'auto'}
                                        onChange={(event) =>
                                            setHttpConfig((currentConfig) => ({
                                                ...currentConfig,
                                                responseMode:
                                                    event.target.value as HttpBlockConfig['responseMode'],
                                            }))
                                        }
                                    >
                                        <option value="auto">Auto</option>
                                        <option value="json">JSON</option>
                                        <option value="text">Text</option>
                                    </select>
                                </label>

                                <label className="block-settings-modal__field">
                                    <span className="block-settings-modal__label">Таймаут, мс</span>
                                    <input
                                        className="block-settings-modal__input"
                                        type="number"
                                        min={1000}
                                        max={60000}
                                        step={1000}
                                        value={httpConfig.timeoutMs ?? 10000}
                                        onChange={(event) =>
                                            setHttpConfig((currentConfig) => ({
                                                ...currentConfig,
                                                timeoutMs: Math.min(
                                                    Math.max(Number(event.target.value) || 10000, 1000),
                                                    60000,
                                                ),
                                            }))
                                        }
                                    />
                                </label>
                            </div>

                            <label className="block-settings-modal__field">
                                <span className="block-settings-modal__label">Лимит ответа, символов</span>
                                <input
                                    className="block-settings-modal__input"
                                    type="number"
                                    min={1000}
                                    max={200000}
                                    step={1000}
                                    value={httpConfig.maxResponseChars ?? 50000}
                                    onChange={(event) =>
                                        setHttpConfig((currentConfig) => ({
                                            ...currentConfig,
                                            maxResponseChars: Math.min(
                                                Math.max(Number(event.target.value) || 50000, 1000),
                                                200000,
                                            ),
                                        }))
                                    }
                                />
                            </label>

                            <label className="block-settings-modal__checkbox-field block-settings-modal__checkbox-field--compact">
                                <input
                                    type="checkbox"
                                    checked={httpConfig.continueOnError ?? false}
                                    onChange={(event) =>
                                        setHttpConfig((currentConfig) => ({
                                            ...currentConfig,
                                            continueOnError: event.target.checked,
                                        }))
                                    }
                                />
                                <span>Не останавливать workflow при HTTP 4xx/5xx</span>
                            </label>

                            <label className="block-settings-modal__field">
                                <span className="block-settings-modal__label">Headers JSON</span>
                                <textarea
                                    className="block-settings-modal__textarea block-settings-modal__textarea--http-headers"
                                    value={httpConfig.headers}
                                    onChange={(event) =>
                                        setHttpConfig((currentConfig) => ({
                                            ...currentConfig,
                                            headers: event.target.value,
                                        }))
                                    }
                                    placeholder='{"Accept": "application/json"}'
                                />
                            </label>

                            {httpConfig.method !== 'GET' && httpConfig.method !== 'DELETE' && (
                                <label className="block-settings-modal__field">
                                    <span className="block-settings-modal__label">Body JSON / текст</span>
                                    <textarea
                                        className="block-settings-modal__textarea block-settings-modal__textarea--http-body"
                                        value={httpConfig.body}
                                        onChange={(event) =>
                                            setHttpConfig((currentConfig) => ({
                                                ...currentConfig,
                                                body: event.target.value,
                                            }))
                                        }
                                        placeholder='{"text": "{{value.text}}"}'
                                    />
                                </label>
                            )}
                        </section>
                    )}

                    {blockType === 'loop' && (
                        <section className="block-settings-modal__type-section">
                            <h3 className="block-settings-modal__section-title">Цикл / итерация</h3>

                            <div className="block-settings-modal__grid">
                                <label className="block-settings-modal__field">
                                    <span className="block-settings-modal__label">Путь к коллекции</span>
                                    <input
                                        className="block-settings-modal__input"
                                        value={loopConfig.collectionPath}
                                        onChange={(event) =>
                                            setLoopConfig((currentConfig) => ({
                                                ...currentConfig,
                                                collectionPath: event.target.value,
                                            }))
                                        }
                                        placeholder="value.items"
                                    />
                                </label>

                                <label className="block-settings-modal__field">
                                    <span className="block-settings-modal__label">Имя элемента</span>
                                    <input
                                        className="block-settings-modal__input"
                                        value={loopConfig.itemName}
                                        onChange={(event) =>
                                            setLoopConfig((currentConfig) => ({
                                                ...currentConfig,
                                                itemName: event.target.value,
                                            }))
                                        }
                                        placeholder="item"
                                    />
                                </label>

                                <label className="block-settings-modal__field">
                                    <span className="block-settings-modal__label">Режим</span>
                                    <select
                                        className="block-settings-modal__input"
                                        value={loopConfig.mode}
                                        onChange={(event) =>
                                            setLoopConfig((currentConfig) => ({
                                                ...currentConfig,
                                                mode: event.target.value as LoopBlockConfig['mode'],
                                            }))
                                        }
                                    >
                                        <option value="map">map — вернуть массив результатов</option>
                                        <option value="forEach">forEach — выполнить без отдельного результата</option>
                                    </select>
                                </label>
                            </div>
                        </section>
                    )}

                    {blockType === 'merge' && (
                        <section className="block-settings-modal__type-section">
                            <h3 className="block-settings-modal__section-title">Объединение веток</h3>

                            <label className="block-settings-modal__field">
                                <span className="block-settings-modal__label">Режим объединения</span>
                                <select
                                    className="block-settings-modal__input"
                                    value={mergeConfig.mode}
                                    onChange={(event) =>
                                        setMergeConfig((currentConfig) => ({
                                            ...currentConfig,
                                            mode: event.target.value as MergeBlockConfig['mode'],
                                        }))
                                    }
                                >
                                    <option value="passThrough">Пропустить первый доступный результат</option>
                                    <option value="combine">Объединить входящие результаты</option>
                                </select>
                            </label>
                        </section>
                    )}

                    {blockType === 'log' && (
                        <section className="block-settings-modal__type-section">
                            <h3 className="block-settings-modal__section-title">Логирование</h3>

                            <label className="block-settings-modal__field">
                                <span className="block-settings-modal__label">Уровень</span>
                                <select
                                    className="block-settings-modal__input"
                                    value={logConfig.level}
                                    onChange={(event) =>
                                        setLogConfig((currentConfig) => ({
                                            ...currentConfig,
                                            level: event.target.value as LogBlockConfig['level'],
                                        }))
                                    }
                                >
                                    <option value="info">Info</option>
                                    <option value="warning">Warning</option>
                                    <option value="error">Error</option>
                                </select>
                            </label>

                            <label className="block-settings-modal__field">
                                <span className="block-settings-modal__label">Шаблон сообщения</span>
                                <textarea
                                    className="block-settings-modal__textarea"
                                    value={logConfig.messageTemplate}
                                    onChange={(event) =>
                                        setLogConfig((currentConfig) => ({
                                            ...currentConfig,
                                            messageTemplate: event.target.value,
                                        }))
                                    }
                                    placeholder="AI result: {{value.text}}"
                                />
                            </label>
                        </section>
                    )}
                </div>

                <footer className="block-settings-modal__footer">
                    <button
                        className="block-settings-modal__button block-settings-modal__button--save"
                        type="button"
                        onClick={handleSave}
                    >
                        Сохранить
                    </button>

                    <button
                        className="block-settings-modal__button block-settings-modal__button--cancel"
                        type="button"
                        onClick={onClose}
                    >
                        Отменить
                    </button>
                </footer>
            </div>
        </div>,
        document.body,
    );
}

export default BlockSettingsModal;

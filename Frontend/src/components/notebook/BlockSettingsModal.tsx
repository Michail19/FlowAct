import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import type {
    ActionBlockConfig,
    ConditionBlockConfig,
    DatabaseBlockConfig,
    EmailBlockConfig,
    LogBlockConfig,
    NotebookBlockConfig,
    NotebookBlockType,
} from './notebookTypes';

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

const conditionOperatorLabels = {
    equals: 'равно',
    notEquals: 'не равно',
    contains: 'содержит',
    greaterThan: 'больше',
    lessThan: 'меньше',
    exists: 'существует',
};

function getDefaultConditionConfig(config?: NotebookBlockConfig): ConditionBlockConfig {
    return {
        leftValue: config?.condition?.leftValue ?? 'input.value',
        operator: config?.condition?.operator ?? 'equals',
        rightValue: config?.condition?.rightValue ?? '',
    };
}

function getDefaultActionConfig(config?: NotebookBlockConfig): ActionBlockConfig {
    return {
        actionType: config?.action?.actionType ?? 'format',
        parameters: config?.action?.parameters ?? '',
    };
}

function getDefaultDatabaseConfig(config?: NotebookBlockConfig): DatabaseBlockConfig {
    return {
        operation: config?.database?.operation ?? 'select',
        tableName: config?.database?.tableName ?? '',
        query: config?.database?.query ?? '',
        payload: config?.database?.payload ?? '',
    };
}

function getDefaultEmailConfig(config?: NotebookBlockConfig): EmailBlockConfig {
    return {
        recipient: config?.email?.recipient ?? '',
        subject: config?.email?.subject ?? '',
        body: config?.email?.body ?? '',
    };
}

function getDefaultLogConfig(config?: NotebookBlockConfig): LogBlockConfig {
    return {
        level: config?.log?.level ?? 'info',
        messageTemplate: config?.log?.messageTemplate ?? '{{result}}',
    };
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
    const [title, setTitle] = useState(initialTitle);
    const [subtitle, setSubtitle] = useState(initialSubtitle);
    const [description, setDescription] = useState(initialDescription);

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
            return {
                condition: conditionConfig,
            };
        }

        if (blockType === 'action') {
            return {
                action: actionConfig,
            };
        }

        if (blockType === 'database') {
            return {
                database: databaseConfig,
            };
        }

        if (blockType === 'email') {
            return {
                email: emailConfig,
            };
        }

        if (blockType === 'log') {
            return {
                log: logConfig,
            };
        }

        return undefined;
    };

    const handleSave = () => {
        onSave({
            title: title.trim() || 'Блок',
            subtitle: subtitle.trim(),
            description: description.trim(),
            config: getConfigByBlockType(),
        });
    };

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
                    <label className="block-settings-modal__field">
                        <span className="block-settings-modal__label">Название</span>
                        <input
                            className="block-settings-modal__input"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Название блока"
                        />
                    </label>

                    <label className="block-settings-modal__field">
                        <span className="block-settings-modal__label">Краткое описание</span>
                        <input
                            className="block-settings-modal__input"
                            value={subtitle}
                            onChange={(event) => setSubtitle(event.target.value)}
                            placeholder="Краткое описание"
                        />
                    </label>

                    <label className="block-settings-modal__field">
                        <span className="block-settings-modal__label">Описание</span>
                        <textarea
                            className="block-settings-modal__textarea"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder="Что делает этот блок"
                        />
                    </label>

                    {blockType === 'condition' && (
                        <section className="block-settings-modal__type-section">
                            <h3 className="block-settings-modal__section-title">Условие</h3>

                            <div className="block-settings-modal__grid">
                                <label className="block-settings-modal__field">
                                    <span className="block-settings-modal__label">Левое значение</span>
                                    <input
                                        className="block-settings-modal__input"
                                        value={conditionConfig.leftValue}
                                        onChange={(event) =>
                                            setConditionConfig((currentConfig) => ({
                                                ...currentConfig,
                                                leftValue: event.target.value,
                                            }))
                                        }
                                        placeholder="input.status"
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
                                    <span className="block-settings-modal__label">Правое значение</span>
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
                                    <option value="httpRequest">HTTP-запрос</option>
                                    <option value="custom">Пользовательское действие</option>
                                </select>
                            </label>

                            <label className="block-settings-modal__field">
                                <span className="block-settings-modal__label">Параметры</span>
                                <textarea
                                    className="block-settings-modal__textarea"
                                    value={actionConfig.parameters}
                                    onChange={(event) =>
                                        setActionConfig((currentConfig) => ({
                                            ...currentConfig,
                                            parameters: event.target.value,
                                        }))
                                    }
                                    placeholder='Например: {"format": "json"}'
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
                                    <span className="block-settings-modal__label">Таблица</span>
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
                                    placeholder="SELECT * FROM table WHERE id = {{id}}"
                                />
                            </label>

                            <label className="block-settings-modal__field">
                                <span className="block-settings-modal__label">Payload</span>
                                <textarea
                                    className="block-settings-modal__textarea"
                                    value={databaseConfig.payload}
                                    onChange={(event) =>
                                        setDatabaseConfig((currentConfig) => ({
                                            ...currentConfig,
                                            payload: event.target.value,
                                        }))
                                    }
                                    placeholder='{"result": "{{result}}"}'
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
                                    placeholder="user@example.com"
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
                                    placeholder="Результат выполнения FlowAct"
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
                                    placeholder="Рабочий процесс завершён. Результат: {{result}}"
                                />
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
                                    placeholder="Результат выполнения: {{result}}"
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

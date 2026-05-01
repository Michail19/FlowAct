import { Handle, Position, type NodeProps } from '@xyflow/react';

import type { NotebookBlockStatus, NotebookNode } from './notebookTypes';

import './CustomBlockNode.css';

const statusLabels: Record<NotebookBlockStatus, string> = {
    idle: 'Ожидает',
    pending: 'В очереди',
    running: 'Выполняется',
    success: 'Успешно',
    error: 'Ошибка',
    skipped: 'Пропущен',
    waiting: 'Ожидает события',
};

const blockTypeLabels: Record<string, string> = {
    start: 'START',
    end: 'END',
    ai: 'AI',
    condition: 'CONDITION',
    action: 'ACTION',
    database: 'DATABASE',
    email: 'EMAIL',
    log: 'LOG',
    http: 'HTTP',
    loop: 'LOOP',
    merge: 'MERGE',
};

function stopReactFlowEvent(event: React.SyntheticEvent) {
    event.stopPropagation();
}

function CustomBlockNode({ id, data, selected }: NodeProps<NotebookNode>) {
    const status = data.status ?? 'idle';
    const isCondition = data.blockType === 'condition';

    const nodeClassName = [
        'custom-block-node',
        `custom-block-node--${data.blockType}`,
        `custom-block-node--${status}`,
        selected ? 'custom-block-node--selected' : '',
    ]
        .filter(Boolean)
        .join(' ');

    const canHaveInput = data.blockType !== 'start';
    const canHaveOutput = data.blockType !== 'end';

    const handleRun = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        data.onRun?.(id);
    };

    const handleEdit = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        data.onEdit?.(id);
    };

    const handleDelete = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        data.onDelete?.(id);
    };

    return (
        <article className={nodeClassName}>
            {canHaveInput && (
                <Handle
                    className="custom-block-node__handle custom-block-node__handle--target"
                    type="target"
                    position={Position.Left}
                />
            )}

            <header className="custom-block-node__header">
                <button
                    className="custom-block-node__run nodrag nopan"
                    type="button"
                    aria-label="Запустить блок"
                    onPointerDown={stopReactFlowEvent}
                    onClick={handleRun}
                >
                    ▶
                </button>

                <div className="custom-block-node__heading">
                    <span className="custom-block-node__icon" aria-hidden="true">
                        {data.icon}
                    </span>

                    <div className="custom-block-node__text">
                        <strong className="custom-block-node__title">{data.title}</strong>

                        {data.subtitle && (
                            <span className="custom-block-node__subtitle">{data.subtitle}</span>
                        )}
                    </div>
                </div>

                <div className="custom-block-node__actions">
                    <button
                        className="custom-block-node__action custom-block-node__action--edit nodrag nopan"
                        type="button"
                        aria-label="Редактировать блок"
                        onPointerDown={stopReactFlowEvent}
                        onClick={handleEdit}
                    >
                        ✎
                    </button>

                    <button
                        className="custom-block-node__action custom-block-node__action--delete nodrag nopan"
                        type="button"
                        aria-label="Удалить блок"
                        onPointerDown={stopReactFlowEvent}
                        onClick={handleDelete}
                    >
                        ×
                    </button>
                </div>
            </header>

            {isCondition ? (
                <div className="custom-block-node__condition">
                    <p className="custom-block-node__condition-text">
                        {data.description || 'Проверяет условие и выбирает одну из веток выполнения.'}
                    </p>
                </div>
            ) : (
                data.description && (
                    <p className="custom-block-node__description">{data.description}</p>
                )
            )}

            <footer className="custom-block-node__footer">
                <span className="custom-block-node__type">
                    {blockTypeLabels[data.blockType] ?? data.blockType}
                </span>
                <span className="custom-block-node__status">{statusLabels[status]}</span>
            </footer>

            {canHaveOutput && !isCondition && (
                <Handle
                    className="custom-block-node__handle custom-block-node__handle--source"
                    type="source"
                    position={Position.Right}
                />
            )}

            {canHaveOutput && isCondition && (
                <>
                    <span className="custom-block-node__handle-label custom-block-node__handle-label--yes">
                        Да
                    </span>
                    <Handle
                        id="yes"
                        className="custom-block-node__handle custom-block-node__handle--source custom-block-node__handle--source-yes"
                        type="source"
                        position={Position.Right}
                    />

                    <span className="custom-block-node__handle-label custom-block-node__handle-label--no">
                        Нет
                    </span>
                    <Handle
                        id="no"
                        className="custom-block-node__handle custom-block-node__handle--source custom-block-node__handle--source-no"
                        type="source"
                        position={Position.Right}
                    />
                </>
            )}
        </article>
    );
}

export default CustomBlockNode;

import { Handle, Position, type NodeProps } from '@xyflow/react';

import { getAiModelName } from './aiModels';
import NotebookSvgIcon from './NotebookSvgIcon';
import type { NotebookBlockStatus, NotebookNode } from './notebookTypes';

import './AiBlockNode.css';

type AiBlockNodeProps = NodeProps<NotebookNode>;

const statusLabels: Record<NotebookBlockStatus, string> = {
    idle: 'Ожидает',
    pending: 'В очереди',
    running: 'Выполняется',
    success: 'Успешно',
    error: 'Ошибка',
    skipped: 'Пропущен',
    waiting: 'Ожидает события',
};

function stopReactFlowEvent(event: React.SyntheticEvent) {
    event.stopPropagation();
}

function getPromptPreview(prompt?: string): string {
    if (!prompt?.trim()) {
        return 'Текст запроса не задан';
    }

    const normalizedPrompt = prompt.trim().replace(/\s+/g, ' ');

    if (normalizedPrompt.length <= 90) {
        return normalizedPrompt;
    }

    return `${normalizedPrompt.slice(0, 90)}...`;
}

function AiBlockNode({ id, data, selected }: AiBlockNodeProps) {
    const status = data.status ?? 'idle';
    const selectedModels = data.aiConfig?.models ?? [];
    const promptPreview = getPromptPreview(data.aiConfig?.prompt);

    const nodeClassName = [
        'ai-block-node',
        `ai-block-node--${status}`,
        selected ? 'ai-block-node--selected' : '',
    ]
        .filter(Boolean)
        .join(' ');

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
            <Handle
                className="ai-block-node__handle ai-block-node__handle--target"
                type="target"
                position={Position.Left}
            />

            <header className="ai-block-node__header">
                <button
                    className="ai-block-node__run nodrag nopan"
                    type="button"
                    aria-label="Запустить AI-блок"
                    onPointerDown={stopReactFlowEvent}
                    onClick={handleRun}
                >
                    <NotebookSvgIcon name="play" size={14} />
                </button>

                <div className="ai-block-node__heading">
                    <span className="ai-block-node__icon" aria-hidden="true">
                        <NotebookSvgIcon name="ai" />
                    </span>
                    <h3 className="ai-block-node__title">{data.title}</h3>
                </div>

                <div className="ai-block-node__actions">
                    <button
                        className="ai-block-node__action ai-block-node__action--edit nodrag nopan"
                        type="button"
                        aria-label="Редактировать AI-блок"
                        onPointerDown={stopReactFlowEvent}
                        onClick={handleEdit}
                    >
                        <NotebookSvgIcon name="edit" size={12} />
                    </button>

                    <button
                        className="ai-block-node__action ai-block-node__action--delete nodrag nopan"
                        type="button"
                        aria-label="Удалить AI-блок"
                        onPointerDown={stopReactFlowEvent}
                        onClick={handleDelete}
                    >
                        <NotebookSvgIcon name="trash" size={12} />
                    </button>
                </div>
            </header>

            <div className="ai-block-node__content">
                <p className="ai-block-node__prompt">{promptPreview}</p>

                <div className="ai-block-node__models" aria-label="Выбранные нейросети">
                    {selectedModels.length > 0 ? (
                        selectedModels.slice(0, 4).map((modelId) => (
                            <span className="ai-block-node__model" key={modelId}>
                                {getAiModelName(modelId)}
                            </span>
                        ))
                    ) : (
                        <span className="ai-block-node__model ai-block-node__model--empty">
                            Модель не выбрана
                        </span>
                    )}

                    {selectedModels.length > 4 && (
                        <span className="ai-block-node__model ai-block-node__model--more">
                            +{selectedModels.length - 4}
                        </span>
                    )}
                </div>
            </div>

            <footer className="ai-block-node__footer">
                <span className="ai-block-node__type">AI</span>
                <span className="ai-block-node__status">{statusLabels[status]}</span>
            </footer>

            <Handle
                className="ai-block-node__handle ai-block-node__handle--source"
                type="source"
                position={Position.Right}
            />
        </article>
    );
}

export default AiBlockNode;

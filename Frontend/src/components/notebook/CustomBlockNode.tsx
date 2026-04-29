import { Handle, Position, type NodeProps } from '@xyflow/react';

import type { NotebookNode } from './notebookTypes';

import './CustomBlockNode.css';

const statusLabels = {
    idle: 'Ожидает',
    running: 'Выполняется',
    success: 'Успешно',
    error: 'Ошибка',
};

function CustomBlockNode({ data, selected }: NodeProps<NotebookNode>) {
    const status = data.status ?? 'idle';

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

    return (
        <article className={nodeClassName}>
            {canHaveInput && (
                <Handle
                    className="custom-block-node__handle custom-block-node__handle--target"
                    type="target"
                    position={Position.Left}
                />
            )}

            <div className="custom-block-node__header">
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

            <div className="custom-block-node__footer">
                <span className="custom-block-node__type">{data.blockType}</span>
                <span className="custom-block-node__status">{statusLabels[status]}</span>
            </div>

            {canHaveOutput && (
                <Handle
                    className="custom-block-node__handle custom-block-node__handle--source"
                    type="source"
                    position={Position.Right}
                />
            )}
        </article>
    );
}

export default CustomBlockNode;

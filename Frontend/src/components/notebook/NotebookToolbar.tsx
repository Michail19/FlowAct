import { NOTEBOOK_BLOCK_LIBRARY } from './blockLibrary';
import NotebookIconButton from './NotebookIconButton';
import type { NotebookBlockType } from './notebookTypes';

import './NotebookToolbar.css';

type NotebookToolbarProps = {
    onAddBlock: (blockType: NotebookBlockType) => void;
    onRunWorkflow: () => void;
    onOpenRunPanel: () => void;
    onAutoLayout: () => void;
    isWorkflowRunning: boolean;
};

function NotebookToolbar({
                             onAddBlock,
                             onRunWorkflow,
                             onOpenRunPanel,
                             onAutoLayout,
                             isWorkflowRunning,
                         }: NotebookToolbarProps) {
    return (
        <aside className="notebook-toolbar" aria-label="Панель блоков">
            <div className="notebook-toolbar__blocks">
                {NOTEBOOK_BLOCK_LIBRARY.map((block) => (
                    <NotebookIconButton
                        key={block.blockType}
                        icon={block.toolbarIcon}
                        label={block.toolbarLabel}
                        onClick={() => onAddBlock(block.blockType)}
                    />
                ))}
            </div>

            <div className="notebook-toolbar__actions">
                <NotebookIconButton
                    icon="✦"
                    label="Автосборка схемы"
                    variant="circle"
                    onClick={onAutoLayout}
                />

                <NotebookIconButton
                    icon="🧾"
                    label="Показать логи выполнения"
                    variant="circle"
                    onClick={onOpenRunPanel}
                />

                <NotebookIconButton
                    icon={isWorkflowRunning ? '…' : '▶'}
                    label={isWorkflowRunning ? 'Рабочий процесс выполняется' : 'Запустить рабочий процесс'}
                    active
                    variant="circle"
                    onClick={onRunWorkflow}
                    disabled={isWorkflowRunning}
                />
            </div>
        </aside>
    );
}

export default NotebookToolbar;

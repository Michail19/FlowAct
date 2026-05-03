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

type ToolbarGroup = {
    id: string;
    title: string;
    blockTypes: NotebookBlockType[];
};

const toolbarGroups: ToolbarGroup[] = [
    {
        id: 'base',
        title: 'Основные блоки',
        blockTypes: ['start', 'end', 'condition', 'merge', 'loop'],
    },
    {
        id: 'actions',
        title: 'Действия',
        blockTypes: ['action', 'log'],
    },
    {
        id: 'integrations',
        title: 'Интеграции',
        blockTypes: ['ai', 'http', 'database', 'email'],
    },
];

const blockDefinitionByType = new Map(
    NOTEBOOK_BLOCK_LIBRARY.map((block) => [block.blockType, block]),
);

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
                {toolbarGroups.map((group) => (
                    <div
                        className="notebook-toolbar__group"
                        key={group.id}
                        aria-label={group.title}
                        title={group.title}
                    >
                        {group.blockTypes.map((blockType) => {
                            const block = blockDefinitionByType.get(blockType);

                            if (!block) {
                                return null;
                            }

                            return (
                                <NotebookIconButton
                                    key={block.blockType}
                                    icon={block.toolbarIcon}
                                    label={block.toolbarLabel}
                                    onClick={() => onAddBlock(block.blockType)}
                                />
                            );
                        })}
                    </div>
                ))}
            </div>

            <div className="notebook-toolbar__actions">
                <NotebookIconButton
                    icon="sparkles"
                    label="Автосборка схемы"
                    variant="circle"
                    onClick={onAutoLayout}
                />

                <NotebookIconButton
                    icon="logs"
                    label="Показать логи выполнения"
                    variant="circle"
                    onClick={onOpenRunPanel}
                />

                <NotebookIconButton
                    icon={isWorkflowRunning ? 'loading' : 'play'}
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

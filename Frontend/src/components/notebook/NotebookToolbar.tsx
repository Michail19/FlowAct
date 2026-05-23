import { NOTEBOOK_BLOCK_LIBRARY } from './blockLibrary';
import NotebookIconButton from './NotebookIconButton';
import type {
    NotebookAutoLayoutMode,
    NotebookBlockType,
} from './notebookTypes';
import { useDemoNotebookMode } from './useDemoNotebookMode';

import './NotebookToolbar.css';

type NotebookToolbarProps = {
    onAddBlock: (blockType: NotebookBlockType) => void;
    onRunWorkflow: () => void;
    onOpenRunPanel: () => void;
    onAutoLayout: (mode?: NotebookAutoLayoutMode) => void;
    onValidateWorkflow: () => void;
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

const demoToolbarGroups: ToolbarGroup[] = [
    {
        id: 'demo-base',
        title: 'Demo-блоки',
        blockTypes: ['start', 'end', 'condition', 'action', 'log'],
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
    onValidateWorkflow,
    isWorkflowRunning,
}: NotebookToolbarProps) {
    const isDemoMode = useDemoNotebookMode();
    const activeToolbarGroups = isDemoMode ? demoToolbarGroups : toolbarGroups;

    return (
        <aside className="notebook-toolbar" aria-label="Панель блоков">
            <div className="notebook-toolbar__blocks">
                {activeToolbarGroups.map((group) => (
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
                    label="Автосборка схемы (Ctrl+Shift+A)"
                    variant="circle"
                    onClick={() => onAutoLayout('arrange-connect')}
                />

                {!isDemoMode && (
                    <>
                        <NotebookIconButton
                            icon="schemaCheck"
                            label="Проверить схему (Ctrl+Shift+V)"
                            variant="circle"
                            onClick={onValidateWorkflow}
                        />

                        <NotebookIconButton
                            icon="logs"
                            label="Показать логи выполнения (Ctrl+Shift+L)"
                            variant="circle"
                            onClick={onOpenRunPanel}
                        />

                        <NotebookIconButton
                            icon={isWorkflowRunning ? 'loading' : 'play'}
                            label={isWorkflowRunning ? 'Рабочий процесс выполняется' : 'Запустить рабочий процесс (Ctrl+Enter)'}
                            active
                            variant="circle"
                            onClick={onRunWorkflow}
                            disabled={isWorkflowRunning}
                        />
                    </>
                )}
            </div>
        </aside>
    );
}

export default NotebookToolbar;

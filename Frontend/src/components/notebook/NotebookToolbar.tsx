import { useEffect } from 'react';

import { NOTEBOOK_BLOCK_LIBRARY } from './blockLibrary';
import NotebookIconButton from './NotebookIconButton';
import type {
    NotebookAutoLayoutMode,
    NotebookBlockType,
} from './notebookTypes';
import {
    isPrimaryShortcut,
    isShortcutKey,
    shouldIgnoreCanvasShortcut,
} from './keyboardShortcutUtils';

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
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (shouldIgnoreCanvasShortcut(event) || !isPrimaryShortcut(event)) {
                return;
            }

            if (isShortcutKey(event, 'Enter')) {
                if (isWorkflowRunning) {
                    return;
                }

                event.preventDefault();
                onRunWorkflow();
                return;
            }

            if (event.shiftKey && isShortcutKey(event, 'a')) {
                event.preventDefault();
                onAutoLayout('arrange-connect');
                return;
            }

            if (event.shiftKey && isShortcutKey(event, 'v')) {
                event.preventDefault();
                onValidateWorkflow();
                return;
            }

            if (event.shiftKey && isShortcutKey(event, 'l')) {
                event.preventDefault();
                onOpenRunPanel();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [
        isWorkflowRunning,
        onAutoLayout,
        onOpenRunPanel,
        onRunWorkflow,
        onValidateWorkflow,
    ]);

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
                    label="Автосборка схемы (Ctrl+Shift+A)"
                    variant="circle"
                    onClick={() => onAutoLayout('arrange-connect')}
                />

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
            </div>
        </aside>
    );
}

export default NotebookToolbar;

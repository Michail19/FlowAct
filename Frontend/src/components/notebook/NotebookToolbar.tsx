import { NOTEBOOK_BLOCK_LIBRARY } from './blockLibrary';
import NotebookIconButton from './NotebookIconButton';
import type { NotebookBlockType } from './notebookTypes';

import './NotebookToolbar.css';

type NotebookToolbarProps = {
    onAddBlock: (blockType: NotebookBlockType) => void;
};

function NotebookToolbar({ onAddBlock }: NotebookToolbarProps) {
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
                <NotebookIconButton icon="✦" label="AI-помощник" active variant="circle" />
                <NotebookIconButton icon="▶" label="Запустить рабочий процесс" active variant="circle" />
            </div>
        </aside>
    );
}

export default NotebookToolbar;

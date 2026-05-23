import { type FormEvent, useEffect, useState } from 'react';

import NotebookSvgIcon from './NotebookSvgIcon';
import type { NotebookHistoryAction, NotebookSearchResult } from './notebookTypes';
import {
    isRedoShortcut,
    isUndoShortcut,
    shouldIgnoreCanvasShortcut,
    stopNotebookShortcutEvent,
} from './keyboardShortcutUtils';

import './NotebookSearch.css';

type NotebookSearchProps = {
    result?: NotebookSearchResult | null;
    onSearch: (query: string) => void;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
};

const HISTORY_ACTION_EVENT = 'flowact:notebook-history-action';

function requestNotebookHistoryAction(action: NotebookHistoryAction) {
    window.dispatchEvent(new CustomEvent(HISTORY_ACTION_EVENT, {
        detail: { action },
    }));
}

function getSearchResultText(result?: NotebookSearchResult | null) {
    if (!result) {
        return '';
    }

    if (!result.query.trim()) {
        return 'Введите запрос для поиска блока';
    }

    if (!result.found) {
        return 'Ничего не найдено';
    }

    return `Найдено: ${(result.activeIndex ?? 0) + 1} из ${result.total} — ${result.matchedTitle}`;
}

function NotebookSearch({
                            result = null,
                            onSearch,
                            onUndo,
                            onRedo,
                            canUndo = false,
                            canRedo = false,
                        }: NotebookSearchProps) {
    const [query, setQuery] = useState('');

    const requestUndo = () => {
        requestNotebookHistoryAction('undo');
        onUndo?.();
    };

    const requestRedo = () => {
        requestNotebookHistoryAction('redo');
        onRedo?.();
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (shouldIgnoreCanvasShortcut(event)) {
                return;
            }

            if (isUndoShortcut(event)) {
                stopNotebookShortcutEvent(event);
                requestNotebookHistoryAction('undo');
                onUndo?.();
                return;
            }

            if (isRedoShortcut(event)) {
                stopNotebookShortcutEvent(event);
                requestNotebookHistoryAction('redo');
                onRedo?.();
            }
        };

        window.addEventListener('keydown', handleKeyDown, { capture: true });

        return () => {
            window.removeEventListener('keydown', handleKeyDown, { capture: true });
        };
    }, [onRedo, onUndo]);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSearch(query);
    };

    const resultText = getSearchResultText(result);
    const canRequestUndo = canUndo || true;
    const canRequestRedo = canRedo || true;

    return (
        <div className="notebook-search">
            <form className="notebook-search__form" onSubmit={handleSubmit}>
                <label className="notebook-search__label">
                    <span className="notebook-search__icon" aria-hidden="true">
                        <NotebookSvgIcon name="search" size={16} />
                    </span>

                    <span className="notebook-search__text">Поиск</span>

                    <input
                        className="notebook-search__input"
                        type="search"
                        placeholder="Поиск блока"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </label>

                <button className="notebook-search__submit" type="submit">
                    Найти
                </button>

                {resultText && (
                    <span
                        className={
                            result?.found
                                ? 'notebook-search__result notebook-search__result--found'
                                : 'notebook-search__result'
                        }
                    >
                        {resultText}
                    </span>
                )}
            </form>

            <div className="notebook-search__history-actions">
                <button
                    className="notebook-search__history-button"
                    type="button"
                    onClick={requestUndo}
                    disabled={!canRequestUndo}
                    aria-label="Отменить последнее действие"
                    title="Отменить последнее действие (Ctrl+Z)"
                >
                    <NotebookSvgIcon name="undo" size={17} />
                </button>

                <button
                    className="notebook-search__history-button"
                    type="button"
                    onClick={requestRedo}
                    disabled={!canRequestRedo}
                    aria-label="Повторить отменённое действие"
                    title="Повторить отменённое действие (Ctrl+Shift+Z / Ctrl+Shift+C / Ctrl+Y)"
                >
                    <NotebookSvgIcon name="redo" size={17} />
                </button>
            </div>
        </div>
    );
}

export default NotebookSearch;

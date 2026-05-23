import { type FormEvent, useEffect, useState } from 'react';

import NotebookSvgIcon from './NotebookSvgIcon';
import type { NotebookSearchResult } from './notebookTypes';
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

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (shouldIgnoreCanvasShortcut(event)) {
                return;
            }

            if (isUndoShortcut(event)) {
                stopNotebookShortcutEvent(event);

                if (!canUndo) {
                    return;
                }

                onUndo?.();
                return;
            }

            if (isRedoShortcut(event)) {
                stopNotebookShortcutEvent(event);

                if (!canRedo) {
                    return;
                }

                onRedo?.();
            }
        };

        window.addEventListener('keydown', handleKeyDown, { capture: true });

        return () => {
            window.removeEventListener('keydown', handleKeyDown, { capture: true });
        };
    }, [canRedo, canUndo, onRedo, onUndo]);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSearch(query);
    };

    const resultText = getSearchResultText(result);

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
                    onClick={onUndo}
                    disabled={!canUndo}
                    aria-label="Отменить последнее действие"
                    title={canUndo ? 'Отменить последнее действие (Ctrl+Z)' : 'Нет действий для отмены'}
                >
                    <NotebookSvgIcon name="undo" size={17} />
                </button>

                <button
                    className="notebook-search__history-button"
                    type="button"
                    onClick={onRedo}
                    disabled={!canRedo}
                    aria-label="Повторить отменённое действие"
                    title={canRedo ? 'Повторить отменённое действие (Ctrl+Shift+Z / Ctrl+Shift+C / Ctrl+Y)' : 'Нет действий для повтора'}
                >
                    <NotebookSvgIcon name="redo" size={17} />
                </button>
            </div>
        </div>
    );
}

export default NotebookSearch;

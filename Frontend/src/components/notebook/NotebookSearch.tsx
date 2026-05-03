import { type FormEvent, useState } from 'react';

import type { NotebookSearchResult } from './notebookTypes';

import './NotebookSearch.css';
import NotebookSvgIcon from "./NotebookSvgIcon";

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
                    title={canUndo ? 'Отменить последнее действие' : 'Нет действий для отмены'}
                >
                    <NotebookSvgIcon name="undo" size={17} />
                    <span>Undo</span>
                </button>

                <button
                    className="notebook-search__history-button"
                    type="button"
                    onClick={onRedo}
                    disabled={!canRedo}
                    title={canRedo ? 'Повторить отменённое действие' : 'Нет действий для повтора'}
                >
                    <NotebookSvgIcon name="redo" size={17} />
                    <span>Redo</span>
                </button>
            </div>
        </div>
    );
}

export default NotebookSearch;

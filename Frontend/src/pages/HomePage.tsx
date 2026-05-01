import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
    createEmptyNotebookLocally,
    deleteNotebookLocally,
    listNotebooksLocally,
    loadNotebookLocally,
    type NotebookListItem,
} from '../services/notebookStorage';

import './HomePage.css';

function formatNotebookDate(date: string) {
    return new Date(date).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getPreviewBlockClass(blockType: string) {
    return [
        'home-page__preview-block',
        `home-page__preview-block--${blockType}`,
    ].join(' ');
}

function NotebookPreview({ notebookId }: { notebookId: string }) {
    const notebook = loadNotebookLocally(notebookId);
    const blocks = notebook?.blocks.slice(0, 9) ?? [];
    const blockIds = new Set(blocks.map((block) => block.id));
    const connections =
        notebook?.connections.filter(
            (connection) =>
                blockIds.has(connection.sourceBlockId) &&
                blockIds.has(connection.targetBlockId),
        ) ?? [];

    if (blocks.length === 0) {
        return (
            <div className="home-page__preview home-page__preview--empty">
                <div className="home-page__preview-placeholder" />
            </div>
        );
    }

    const xValues = blocks.map((block) => block.position.x);
    const yValues = blocks.map((block) => block.position.y);

    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    const width = Math.max(maxX - minX, 1);
    const height = Math.max(maxY - minY, 1);

    const positionsById = new Map(
        blocks.map((block) => {
            const x = 10 + ((block.position.x - minX) / width) * 72;
            const y = 10 + ((block.position.y - minY) / height) * 72;

            return [block.id, { x, y }];
        }),
    );

    return (
        <div className="home-page__preview">
            <div className="home-page__preview-canvas">
                <svg
                    className="home-page__preview-lines"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                >
                    {connections.map((connection) => {
                        const sourcePosition = positionsById.get(connection.sourceBlockId);
                        const targetPosition = positionsById.get(connection.targetBlockId);

                        if (!sourcePosition || !targetPosition) {
                            return null;
                        }

                        return (
                            <line
                                key={connection.id}
                                x1={sourcePosition.x}
                                y1={sourcePosition.y}
                                x2={targetPosition.x}
                                y2={targetPosition.y}
                            />
                        );
                    })}
                </svg>

                {blocks.map((block) => {
                    const position = positionsById.get(block.id);

                    if (!position) {
                        return null;
                    }

                    return (
                        <span
                            className={getPreviewBlockClass(block.type)}
                            key={block.id}
                            style={{
                                left: `${position.x}%`,
                                top: `${position.y}%`,
                            }}
                            title={block.title}
                        />
                    );
                })}
            </div>
        </div>
    );
}

function HomePage() {
    const navigate = useNavigate();
    const [notebooks, setNotebooks] = useState<NotebookListItem[]>(() =>
        listNotebooksLocally(),
    );
    const [search, setSearch] = useState('');
    const [notebookToDelete, setNotebookToDelete] = useState<NotebookListItem | null>(null);

    const normalizedSearch = search.trim().toLowerCase();
    const isSearching = normalizedSearch.length > 0;

    const filteredNotebooks = useMemo(() => {
        if (!normalizedSearch) {
            return notebooks;
        }

        return notebooks.filter((notebook) =>
            notebook.title.toLowerCase().includes(normalizedSearch),
        );
    }, [normalizedSearch, notebooks]);

    const handleCreateNotebook = () => {
        const notebook = createEmptyNotebookLocally('Новый notebook');
        setNotebooks(listNotebooksLocally());
        navigate(`/notebook/${notebook.id}`);
    };

    const handleAskDeleteNotebook = (notebook: NotebookListItem) => {
        setNotebookToDelete(notebook);
    };

    const handleConfirmDeleteNotebook = () => {
        if (!notebookToDelete) {
            return;
        }

        deleteNotebookLocally(notebookToDelete.id);
        setNotebooks(listNotebooksLocally());
        setNotebookToDelete(null);
    };

    const handleCancelDeleteNotebook = () => {
        setNotebookToDelete(null);
    };

    const showCreateButtonInEmptyState = notebooks.length === 0 && !isSearching;

    return (
        <main className="home-page">
            <section className="home-page__shell">
                <header className="home-page__topbar">
                    <Link className="home-page__brand" to="/landing">
                        FlowAct
                    </Link>

                    <Link
                        className="home-page__profile"
                        to="/my-account"
                        aria-label="Профиль"
                        title="Профиль"
                    >
                        ◕
                    </Link>
                </header>

                <section className="home-page__content">
                    <div className="home-page__hero">
                        <div className="home-page__hero-text">
                            <h1 className="home-page__title">Добро пожаловать!</h1>
                            <p className="home-page__subtitle">
                                Создавайте, настраивайте и запускайте рабочие процессы.
                            </p>
                        </div>

                        <div className="home-page__hero-actions">
                            <button
                                className="home-page__create-button"
                                type="button"
                                onClick={handleCreateNotebook}
                            >
                                + Создать notebook
                            </button>
                        </div>
                    </div>

                    <section className="home-page__panel">
                        <div className="home-page__panel-header">
                            <h2 className="home-page__panel-title">Notebook</h2>

                            <input
                                className="home-page__search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Поиск по названию"
                            />
                        </div>

                        {filteredNotebooks.length === 0 ? (
                            <div className="home-page__empty">
                                <p className="home-page__empty-title">
                                    {isSearching ? 'Ничего не найдено' : 'Notebook пока нет'}
                                </p>

                                <p className="home-page__empty-text">
                                    {isSearching
                                        ? 'Попробуйте изменить поисковый запрос.'
                                        : 'Создайте первый notebook, чтобы собрать рабочий процесс из блоков.'}
                                </p>

                                {showCreateButtonInEmptyState && (
                                    <button
                                        className="home-page__empty-create-button"
                                        type="button"
                                        onClick={handleCreateNotebook}
                                    >
                                        Создать notebook
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="home-page__grid">
                                {filteredNotebooks.map((notebook) => (
                                    <article className="home-page__card" key={notebook.id}>
                                        <Link
                                            className="home-page__card-link"
                                            to={`/notebook/${notebook.id}`}
                                        >
                                            <NotebookPreview notebookId={notebook.id} />

                                            <h3 className="home-page__card-title">
                                                {notebook.title || '<Название>'}
                                            </h3>

                                            <p className="home-page__card-date">
                                                &lt;Изменён {formatNotebookDate(notebook.updatedAt)}&gt;
                                            </p>

                                            <div className="home-page__card-meta">
                                                <span>{notebook.blocksCount} блоков</span>
                                                <span>{notebook.connectionsCount} связей</span>
                                            </div>
                                        </Link>

                                        <button
                                            className="home-page__delete-button"
                                            type="button"
                                            aria-label={`Удалить ${notebook.title}`}
                                            title="Удалить notebook"
                                            onClick={() => handleAskDeleteNotebook(notebook)}
                                        >
                                            ×
                                        </button>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                </section>
            </section>

            {notebookToDelete && (
                <div
                    className="home-page__modal-overlay"
                    onClick={handleCancelDeleteNotebook}
                    role="presentation"
                >
                    <div
                        className="home-page__modal"
                        onClick={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-notebook-title"
                    >
                        <h3 className="home-page__modal-title" id="delete-notebook-title">
                            Удалить notebook?
                        </h3>

                        <p className="home-page__modal-text">
                            Вы действительно хотите удалить notebook{' '}
                            <strong>“{notebookToDelete.title}”</strong>?
                        </p>

                        <div className="home-page__modal-actions">
                            <button
                                className="home-page__modal-button home-page__modal-button--cancel"
                                type="button"
                                onClick={handleCancelDeleteNotebook}
                            >
                                Отмена
                            </button>

                            <button
                                className="home-page__modal-button home-page__modal-button--delete"
                                type="button"
                                onClick={handleConfirmDeleteNotebook}
                            >
                                Удалить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

export default HomePage;

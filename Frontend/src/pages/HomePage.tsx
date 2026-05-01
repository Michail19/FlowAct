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

    return (
        <div className="home-page__preview">
            <div className="home-page__preview-canvas">
                {blocks.map((block) => {
                    const left = 10 + ((block.position.x - minX) / width) * 72;
                    const top = 10 + ((block.position.y - minY) / height) * 72;

                    return (
                        <span
                            className={getPreviewBlockClass(block.type)}
                            key={block.id}
                            style={{
                                left: `${left}%`,
                                top: `${top}%`,
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

    const filteredNotebooks = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        if (!normalizedSearch) {
            return notebooks;
        }

        return notebooks.filter((notebook) =>
            notebook.title.toLowerCase().includes(normalizedSearch),
        );
    }, [notebooks, search]);

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

    return (
        <main className="home-page">
            <section className="home-page__shell">
                <header className="home-page__topbar">
                    <Link className="home-page__brand" to="/landing">
                        FlowAct
                    </Link>

                    <div className="home-page__topbar-actions">
                        <button
                            className="home-page__create-button"
                            type="button"
                            onClick={handleCreateNotebook}
                        >
                            + Создать notebook
                        </button>

                        <Link
                            className="home-page__profile"
                            to="/my-account"
                            aria-label="Профиль"
                            title="Профиль"
                        >
                            ◕
                        </Link>
                    </div>
                </header>

                <section className="home-page__content">
                    <div className="home-page__hero">
                        <div>
                            <h1 className="home-page__title">Добро пожаловать!</h1>
                            <p className="home-page__subtitle">
                                Создавайте, настраивайте и запускайте рабочие процессы.
                            </p>
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
                                    {search.trim()
                                        ? 'Ничего не найдено'
                                        : 'Notebook пока нет'}
                                </p>

                                <p className="home-page__empty-text">
                                    {search.trim()
                                        ? 'Попробуйте изменить поисковый запрос.'
                                        : 'Создайте первый notebook с помощью кнопки сверху.'}
                                </p>
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

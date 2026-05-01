import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
    createEmptyNotebookLocally,
    deleteNotebookLocally,
    listNotebooksLocally,
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

function HomePage() {
    const navigate = useNavigate();
    const [notebooks, setNotebooks] = useState<NotebookListItem[]>(() =>
        listNotebooksLocally(),
    );
    const [search, setSearch] = useState('');

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

        navigate(`/notebook/${notebook.id}`);
    };

    const handleDeleteNotebook = (notebookId: string) => {
        deleteNotebookLocally(notebookId);
        setNotebooks(listNotebooksLocally());
    };

    return (
        <main className="home-page">
            <section className="home-page__hero">
                <div>
                    <p className="home-page__eyebrow">FlowAct</p>
                    <h1 className="home-page__title">Мои notebook</h1>
                    <p className="home-page__subtitle">
                        Создавайте, настраивайте и запускайте рабочие процессы.
                    </p>
                </div>

                <button
                    className="home-page__create-button"
                    type="button"
                    onClick={handleCreateNotebook}
                >
                    + Создать notebook
                </button>
            </section>

            <section className="home-page__panel">
                <div className="home-page__panel-header">
                    <h2 className="home-page__panel-title">Список notebook</h2>

                    <input
                        className="home-page__search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Поиск по названию"
                    />
                </div>

                {filteredNotebooks.length === 0 ? (
                    <div className="home-page__empty">
                        <h3>Notebook пока нет</h3>
                        <p>
                            Создайте первый notebook, чтобы собрать рабочий процесс
                            из блоков.
                        </p>
                        <button
                            className="home-page__create-button"
                            type="button"
                            onClick={handleCreateNotebook}
                        >
                            Создать notebook
                        </button>
                    </div>
                ) : (
                    <div className="home-page__grid">
                        {filteredNotebooks.map((notebook) => (
                            <article className="home-page__card" key={notebook.id}>
                                <Link
                                    className="home-page__card-link"
                                    to={`/notebook/${notebook.id}`}
                                >
                                    <span className="home-page__card-icon">⛓</span>

                                    <div className="home-page__card-content">
                                        <h3 className="home-page__card-title">
                                            {notebook.title}
                                        </h3>

                                        <p className="home-page__card-date">
                                            Изменён: {formatNotebookDate(notebook.updatedAt)}
                                        </p>

                                        <div className="home-page__card-meta">
                                            <span>{notebook.blocksCount} блоков</span>
                                            <span>{notebook.connectionsCount} связей</span>
                                        </div>
                                    </div>
                                </Link>

                                <button
                                    className="home-page__delete-button"
                                    type="button"
                                    onClick={() => handleDeleteNotebook(notebook.id)}
                                >
                                    Удалить
                                </button>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}

export default HomePage;

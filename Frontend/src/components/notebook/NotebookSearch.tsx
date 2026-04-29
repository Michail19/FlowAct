import './NotebookSearch.css';

function NotebookSearch() {
    return (
        <div className="notebook-search">
            <label className="notebook-search__label">
                <span className="notebook-search__icon" aria-hidden="true">
                    🔍
                </span>
                <span className="notebook-search__text">Поиск</span>
                <input className="notebook-search__input" type="search" placeholder="Поиск" />
            </label>

            <button className="notebook-search__undo" type="button">
                <span aria-hidden="true">↶</span>
                <span>Undo</span>
            </button>
        </div>
    );
}

export default NotebookSearch;

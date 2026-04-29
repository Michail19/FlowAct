import './NotebookMobileActions.css';

function NotebookMobileActions() {
    return (
        <div className="notebook-mobile-actions">
            <button className="notebook-mobile-actions__play" type="button" aria-label="Запустить рабочий процесс">
                ▶
            </button>
            <button className="notebook-mobile-actions__result" type="button">
                Результат
            </button>
        </div>
    );
}

export default NotebookMobileActions;

import { useState } from 'react';

import './NotebookSuggestion.css';

type NotebookSuggestionProps = {
    isMobile: boolean;
};

const STORAGE_KEY = 'flowact-ai-suggestion-disabled';

function getInitialVisibility() {
    if (typeof window === 'undefined') {
        return true;
    }

    return localStorage.getItem(STORAGE_KEY) !== 'true';
}

function NotebookSuggestion({ isMobile }: NotebookSuggestionProps) {
    const [isVisible, setIsVisible] = useState(getInitialVisibility);

    const handleClose = () => {
        setIsVisible(false);
    };

    const handleDisable = () => {
        localStorage.setItem(STORAGE_KEY, 'true');
        setIsVisible(false);
    };

    if (!isVisible) {
        return null;
    }

    return (
        <aside className={isMobile ? 'notebook-suggestion notebook-suggestion--mobile' : 'notebook-suggestion'}>
            <button className="notebook-suggestion__close" type="button" onClick={handleClose}>
                ×
            </button>

            <p className="notebook-suggestion__text">
                Возможный следующий блок: &lt;Название блока&gt;
            </p>

            <div className="notebook-suggestion__actions">
                <button className="notebook-suggestion__button notebook-suggestion__button--accept" type="button">
                    Добавить
                </button>
                <button
                    className="notebook-suggestion__button notebook-suggestion__button--decline"
                    type="button"
                    onClick={handleDisable}
                >
                    Не добавлять
                </button>
            </div>
        </aside>
    );
}

export default NotebookSuggestion;

import { useState } from 'react';

import { getBlockDefinition } from './blockLibrary';
import type { NotebookBlockType } from './notebookTypes';

import './NotebookSuggestion.css';

type NotebookSuggestionData = {
    id: string;
    blockType: NotebookBlockType;
    reason: string;
    confidence: number;
};

type NotebookSuggestionProps = {
    isMobile: boolean;
    suggestion: NotebookSuggestionData | null;
    onAccept: (blockType: NotebookBlockType) => void;
    onDismiss: (suggestionId: string) => void;
};

const STORAGE_KEY = 'flowact-ai-suggestion-disabled';

function getInitialVisibility() {
    if (typeof window === 'undefined') {
        return true;
    }

    return localStorage.getItem(STORAGE_KEY) !== 'true';
}

function NotebookSuggestion({
                                isMobile,
                                suggestion,
                                onAccept,
                                onDismiss,
                            }: NotebookSuggestionProps) {
    const [isEnabled, setIsEnabled] = useState(getInitialVisibility);

    if (!isEnabled || !suggestion) {
        return null;
    }

    const blockDefinition = getBlockDefinition(suggestion.blockType);

    const handleAccept = () => {
        onAccept(suggestion.blockType);
        onDismiss(suggestion.id);
    };

    const handleDismiss = () => {
        onDismiss(suggestion.id);
    };

    const handleDisable = () => {
        localStorage.setItem(STORAGE_KEY, 'true');
        setIsEnabled(false);
    };

    const className = isMobile
        ? 'notebook-suggestion notebook-suggestion--mobile'
        : 'notebook-suggestion';

    return (
        <aside className={className}>
            <button
                className="notebook-suggestion__close"
                type="button"
                aria-label="Закрыть подсказку"
                onClick={handleDismiss}
            >
                ×
            </button>

            <div className="notebook-suggestion__header">
                <span className="notebook-suggestion__icon" aria-hidden="true">
                    ✦
                </span>

                <div>
                    <strong className="notebook-suggestion__title">
                        AI-подсказка
                    </strong>
                    <span className="notebook-suggestion__confidence">
                        уверенность: {suggestion.confidence}%
                    </span>
                </div>
            </div>

            <div className="notebook-suggestion__body">
                <p className="notebook-suggestion__text">
                    Возможный следующий блок:
                </p>

                <article className="notebook-suggestion__block">
                    <span className="notebook-suggestion__block-icon" aria-hidden="true">
                        {blockDefinition.icon}
                    </span>

                    <div className="notebook-suggestion__block-info">
                        <strong>{blockDefinition.title}</strong>
                        <span>{blockDefinition.subtitle}</span>
                    </div>
                </article>

                <p className="notebook-suggestion__reason">
                    {suggestion.reason}
                </p>
            </div>

            <div className="notebook-suggestion__actions">
                <button
                    className="notebook-suggestion__button notebook-suggestion__button--accept"
                    type="button"
                    onClick={handleAccept}
                >
                    Добавить
                </button>

                <button
                    className="notebook-suggestion__button notebook-suggestion__button--decline"
                    type="button"
                    onClick={handleDismiss}
                >
                    Не сейчас
                </button>
            </div>

            <button
                className="notebook-suggestion__disable"
                type="button"
                onClick={handleDisable}
            >
                Отключить подсказки
            </button>
        </aside>
    );
}

export default NotebookSuggestion;

import { useEffect, useState } from 'react';

import { getBlockDefinition } from './blockLibrary';
import type { NotebookRecommendation } from './recommendationTypes';

import './NotebookSuggestion.css';

type NotebookSuggestionProps = {
    isMobile: boolean;
    suggestion: NotebookRecommendation | null;
    onAccept: (suggestion: NotebookRecommendation) => void;
    onDismiss: (suggestionId: string) => void;
};

const STORAGE_KEY = 'flowact-ai-suggestion-disabled';

function getInitialVisibility() {
    if (typeof window === 'undefined') {
        return true;
    }

    return localStorage.getItem(STORAGE_KEY) !== 'true';
}

function getSuggestionTitle(suggestion: NotebookRecommendation) {
    if (suggestion.source === 'ai') {
        return 'AI-подсказка';
    }

    if (suggestion.kind === 'workflow-fix') {
        return 'Подсказка по схеме';
    }

    if (suggestion.kind === 'autocomplete') {
        return 'Автодополнение блока';
    }

    return 'Умная подсказка';
}

function getSuggestionSourceLabel(suggestion: NotebookRecommendation) {
    if (suggestion.source === 'ai') {
        return 'AI';
    }

    return 'локальные правила';
}

function NotebookSuggestion({
                                isMobile,
                                suggestion,
                                onAccept,
                                onDismiss,
                            }: NotebookSuggestionProps) {
    const [initialSuggestionId, setInitialSuggestionId] = useState<string | null>(null);
    const [isEnabled, setIsEnabled] = useState(getInitialVisibility);
    const [isInitialSuggestionSuppressed, setIsInitialSuggestionSuppressed] =
        useState(false);

    useEffect(() => {
        if (!suggestion || initialSuggestionId) {
            return;
        }

        setInitialSuggestionId(suggestion.id);
        setIsInitialSuggestionSuppressed(true);
    }, [initialSuggestionId, suggestion]);

    useEffect(() => {
        if (!suggestion || suggestion.id === initialSuggestionId) {
            return;
        }

        setIsInitialSuggestionSuppressed(false);
    }, [initialSuggestionId, suggestion]);

    const shouldShowSuggestion = Boolean(
        suggestion &&
        (
            suggestion.kind === 'autocomplete' ||
            !isInitialSuggestionSuppressed ||
            suggestion.id !== initialSuggestionId
        ),
    );

    const className = isMobile
        ? 'notebook-suggestion notebook-suggestion--mobile'
        : 'notebook-suggestion';

    if (!isEnabled) {
        return suggestion ? (
            <button
                className={
                    isMobile
                        ? 'notebook-suggestion-toggle notebook-suggestion-toggle--mobile'
                        : 'notebook-suggestion-toggle'
                }
                type="button"
                onClick={() => {
                    localStorage.removeItem(STORAGE_KEY);
                    setIsEnabled(true);
                    setIsInitialSuggestionSuppressed(false);
                }}
            >
                Включить AI-подсказки
            </button>
        ) : null;
    }

    if (!suggestion || !shouldShowSuggestion) {
        return null;
    }

    const blockDefinition = getBlockDefinition(suggestion.blockType);

    const handleAccept = () => {
        onAccept(suggestion);
        onDismiss(suggestion.id);
    };

    const handleDismiss = () => {
        onDismiss(suggestion.id);
    };

    const handleDisable = () => {
        localStorage.setItem(STORAGE_KEY, 'true');
        setIsEnabled(false);
    };

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
                        {getSuggestionTitle(suggestion)}
                    </strong>
                    <span className="notebook-suggestion__confidence">
                        {getSuggestionSourceLabel(suggestion)} · уверенность: {suggestion.confidence}%
                    </span>
                </div>
            </div>

            <div className="notebook-suggestion__body">
                {suggestion.targetBlockTitle && (
                    <p className="notebook-suggestion__text">
                        После блока: <strong>{suggestion.targetBlockTitle}</strong>
                    </p>
                )}

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

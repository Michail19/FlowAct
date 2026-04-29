import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import {
    AI_MODEL_OPTIONS,
    DEFAULT_AI_MODEL_ID,
    getAiModelOption,
} from './aiModels';
import type { AiBlockConfig } from './notebookTypes';

import './AiBlockModal.css';

type AiBlockModalProps = {
    initialTitle: string;
    initialConfig: AiBlockConfig;
    onSave: (title: string, config: AiBlockConfig) => void;
    onClose: () => void;
};

function normalizeModels(models: string[]): string[] {
    const uniqueModels = Array.from(new Set(models.filter(Boolean)));

    if (uniqueModels.length > 0) {
        return uniqueModels;
    }

    return [DEFAULT_AI_MODEL_ID];
}

function AiBlockModal({ initialTitle, initialConfig, onSave, onClose }: AiBlockModalProps) {
    const [title, setTitle] = useState(initialTitle);
    const [prompt, setPrompt] = useState(initialConfig.prompt);
    const [selectedModels, setSelectedModels] = useState<string[]>(
        normalizeModels(initialConfig.models),
    );

    const selectedModelSet = useMemo(() => new Set(selectedModels), [selectedModels]);

    const availableModels = AI_MODEL_OPTIONS.filter(
        (model) => !selectedModelSet.has(model.id),
    );

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    const handleAddModel = (modelId: string) => {
        setSelectedModels((currentModels) => {
            if (currentModels.includes(modelId)) {
                return currentModels;
            }

            return [...currentModels, modelId];
        });
    };

    const handleRemoveModel = (modelId: string) => {
        setSelectedModels((currentModels) => {
            if (currentModels.length <= 1) {
                return currentModels;
            }

            return currentModels.filter((currentModelId) => currentModelId !== modelId);
        });
    };

    const handleSave = () => {
        const normalizedTitle = title.trim() || 'AI-функция';

        onSave(normalizedTitle, {
            prompt,
            models: normalizeModels(selectedModels),
        });
    };

    return createPortal(
        <div
            className="ai-block-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-block-modal-title"
            onPointerDown={(event) => event.stopPropagation()}
        >
            <div className="ai-block-modal__content">
                <header className="ai-block-modal__header">
                    <h2 className="ai-block-modal__title" id="ai-block-modal-title">
                        AI-функция
                    </h2>
                    <button className="ai-block-modal__close" type="button" onClick={onClose}>
                        ×
                    </button>
                </header>

                <label className="ai-block-modal__title-field">
                    <span className="ai-block-modal__visible-label">Название блока</span>
                    <input
                        className="ai-block-modal__title-input"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Название блока"
                    />
                </label>

                <div className="ai-block-modal__body">
                    <label className="ai-block-modal__prompt">
                        <span className="ai-block-modal__visible-label">Текст запроса</span>
                        <textarea
                            className="ai-block-modal__textarea"
                            value={prompt}
                            onChange={(event) => setPrompt(event.target.value)}
                            placeholder="<Введите текст запроса>"
                        />
                    </label>

                    <aside className="ai-block-modal__models-panel">
                        <section className="ai-block-modal__section">
                            <h3 className="ai-block-modal__section-title">Выбранные нейросети</h3>

                            <div className="ai-block-modal__selected-list">
                                {selectedModels.map((modelId) => {
                                    const model = getAiModelOption(modelId);

                                    return (
                                        <article className="ai-block-modal__selected-model" key={modelId}>
                                            <div className="ai-block-modal__model-info">
                                                <strong className="ai-block-modal__model-name">
                                                    {model?.name ?? modelId}
                                                </strong>
                                                <span className="ai-block-modal__model-provider">
                                                    {model?.provider ?? 'Custom'}
                                                </span>
                                            </div>

                                            <button
                                                className="ai-block-modal__remove-model"
                                                type="button"
                                                onClick={() => handleRemoveModel(modelId)}
                                                disabled={selectedModels.length <= 1}
                                                title={
                                                    selectedModels.length <= 1
                                                        ? 'Нужна хотя бы одна нейросеть'
                                                        : 'Убрать нейросеть'
                                                }
                                            >
                                                −
                                            </button>
                                        </article>
                                    );
                                })}
                            </div>
                        </section>

                        <section className="ai-block-modal__section ai-block-modal__section--available">
                            <h3 className="ai-block-modal__section-title">Доступные нейросети</h3>

                            <div className="ai-block-modal__available-list">
                                {availableModels.length > 0 ? (
                                    availableModels.map((model) => (
                                        <article className="ai-block-modal__available-model" key={model.id}>
                                            <div className="ai-block-modal__model-info">
                                                <strong className="ai-block-modal__model-name">
                                                    {model.name}
                                                </strong>
                                                <span className="ai-block-modal__model-provider">
                                                    {model.provider}
                                                </span>
                                                <p className="ai-block-modal__model-description">
                                                    {model.description}
                                                </p>
                                            </div>

                                            <button
                                                className="ai-block-modal__add-model"
                                                type="button"
                                                onClick={() => handleAddModel(model.id)}
                                                aria-label={`Добавить ${model.name}`}
                                            >
                                                +
                                            </button>
                                        </article>
                                    ))
                                ) : (
                                    <p className="ai-block-modal__empty">
                                        Все доступные нейросети уже добавлены.
                                    </p>
                                )}
                            </div>
                        </section>
                    </aside>
                </div>

                <footer className="ai-block-modal__footer">
                    <button
                        className="ai-block-modal__button ai-block-modal__button--save"
                        type="button"
                        onClick={handleSave}
                    >
                        Сохранить
                    </button>

                    <button
                        className="ai-block-modal__button ai-block-modal__button--cancel"
                        type="button"
                        onClick={onClose}
                    >
                        Отменить
                    </button>
                </footer>
            </div>
        </div>,
        document.body,
    );
}

export default AiBlockModal;

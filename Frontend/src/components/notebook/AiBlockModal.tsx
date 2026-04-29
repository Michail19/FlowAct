import { useEffect, useState } from 'react';

import type { AiBlockConfig } from './notebookTypes';

import './AiBlockModal.css';

type AiBlockModalProps = {
    initialConfig: AiBlockConfig;
    onSave: (config: AiBlockConfig) => void;
    onClose: () => void;
};

function AiBlockModal({ initialConfig, onSave, onClose }: AiBlockModalProps) {
    const [prompt, setPrompt] = useState(initialConfig.prompt);
    const [model, setModel] = useState(initialConfig.model);
    const [additionalModel, setAdditionalModel] = useState(initialConfig.additionalModel);
    const [meta, setMeta] = useState(initialConfig.meta);

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

    const handleSave = () => {
        onSave({
            prompt,
            model,
            additionalModel,
            meta,
        });
    };

    return (
        <div className="ai-block-modal" role="dialog" aria-modal="true" aria-labelledby="ai-block-modal-title">
            <div className="ai-block-modal__content">
                <header className="ai-block-modal__header">
                    <h2 className="ai-block-modal__title" id="ai-block-modal-title">
                        AI-функция
                    </h2>
                    <button className="ai-block-modal__close" type="button" onClick={onClose}>
                        ×
                    </button>
                </header>

                <div className="ai-block-modal__body">
                    <label className="ai-block-modal__prompt">
                        <span className="ai-block-modal__label">Текст запроса</span>
                        <textarea
                            className="ai-block-modal__textarea"
                            value={prompt}
                            onChange={(event) => setPrompt(event.target.value)}
                            placeholder="<Введите текст запроса>"
                        />
                    </label>

                    <div className="ai-block-modal__settings">
                        <label className="ai-block-modal__field">
                            <span className="ai-block-modal__label">Основная модель</span>
                            <select
                                className="ai-block-modal__select"
                                value={model}
                                onChange={(event) => setModel(event.target.value)}
                            >
                                <option value="Chat-gpt-4o">Chat-gpt-4o</option>
                                <option value="Chat-gpt-4o-mini">Chat-gpt-4o-mini</option>
                                <option value="Claude 3.5 Sonnet">Claude 3.5 Sonnet</option>
                                <option value="Gemini 1.5 Pro">Gemini 1.5 Pro</option>
                            </select>
                        </label>

                        <label className="ai-block-modal__field">
                            <span className="ai-block-modal__label">Дополнительная модель</span>
                            <select
                                className="ai-block-modal__select"
                                value={additionalModel}
                                onChange={(event) => setAdditionalModel(event.target.value)}
                            >
                                <option value="">Добавить модель</option>
                                <option value="Chat-gpt-4o-mini">Chat-gpt-4o-mini</option>
                                <option value="Claude 3 Haiku">Claude 3 Haiku</option>
                                <option value="Gemini 1.5 Flash">Gemini 1.5 Flash</option>
                            </select>
                        </label>

                        <label className="ai-block-modal__field ai-block-modal__field--meta">
                            <span className="ai-block-modal__label">Краткая информация на блоке</span>
                            <textarea
                                className="ai-block-modal__meta"
                                value={meta}
                                onChange={(event) => setMeta(event.target.value)}
                                placeholder="<Краткая мета-информация>"
                            />
                        </label>
                    </div>
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
        </div>
    );
}

export default AiBlockModal;

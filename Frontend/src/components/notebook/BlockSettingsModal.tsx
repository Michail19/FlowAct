import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import './BlockSettingsModal.css';

type BlockSettingsModalProps = {
    initialTitle: string;
    initialSubtitle?: string;
    initialDescription?: string;
    onSave: (title: string, subtitle: string, description: string) => void;
    onClose: () => void;
};

function BlockSettingsModal({
                                initialTitle,
                                initialSubtitle = '',
                                initialDescription = '',
                                onSave,
                                onClose,
                            }: BlockSettingsModalProps) {
    const [title, setTitle] = useState(initialTitle);
    const [subtitle, setSubtitle] = useState(initialSubtitle);
    const [description, setDescription] = useState(initialDescription);

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
        onSave(
            title.trim() || 'Блок',
            subtitle.trim(),
            description.trim(),
        );
    };

    return createPortal(
        <div
            className="block-settings-modal"
            role="dialog"
            aria-modal="true"
            onPointerDown={(event) => event.stopPropagation()}
        >
            <div className="block-settings-modal__content">
                <header className="block-settings-modal__header">
                    <h2 className="block-settings-modal__title">Настройки блока</h2>
                    <button className="block-settings-modal__close" type="button" onClick={onClose}>
                        ×
                    </button>
                </header>

                <div className="block-settings-modal__body">
                    <label className="block-settings-modal__field">
                        <span className="block-settings-modal__label">Название</span>
                        <input
                            className="block-settings-modal__input"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Название блока"
                        />
                    </label>

                    <label className="block-settings-modal__field">
                        <span className="block-settings-modal__label">Краткое описание</span>
                        <input
                            className="block-settings-modal__input"
                            value={subtitle}
                            onChange={(event) => setSubtitle(event.target.value)}
                            placeholder="Краткое описание"
                        />
                    </label>

                    <label className="block-settings-modal__field">
                        <span className="block-settings-modal__label">Описание</span>
                        <textarea
                            className="block-settings-modal__textarea"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder="Что делает этот блок"
                        />
                    </label>
                </div>

                <footer className="block-settings-modal__footer">
                    <button
                        className="block-settings-modal__button block-settings-modal__button--save"
                        type="button"
                        onClick={handleSave}
                    >
                        Сохранить
                    </button>

                    <button
                        className="block-settings-modal__button block-settings-modal__button--cancel"
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

export default BlockSettingsModal;

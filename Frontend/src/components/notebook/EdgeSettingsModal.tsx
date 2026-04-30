import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import './EdgeSettingsModal.css';

type EdgeSettingsModalProps = {
    initialLabel: string;
    onSave: (label: string) => void;
    onClose: () => void;
};

function EdgeSettingsModal({ initialLabel, onSave, onClose }: EdgeSettingsModalProps) {
    const [label, setLabel] = useState(initialLabel);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }

            if (event.key === 'Enter') {
                onSave(label.trim());
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [label, onClose, onSave]);

    const handleSave = () => {
        onSave(label.trim());
    };

    return createPortal(
        <div
            className="edge-settings-modal"
            role="dialog"
            aria-modal="true"
            onPointerDown={(event) => event.stopPropagation()}
        >
            <div className="edge-settings-modal__content">
                <header className="edge-settings-modal__header">
                    <h2 className="edge-settings-modal__title">Настройки связи</h2>

                    <button
                        className="edge-settings-modal__close"
                        type="button"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </header>

                <label className="edge-settings-modal__field">
                    <span className="edge-settings-modal__label">Подпись стрелки</span>

                    <input
                        className="edge-settings-modal__input"
                        value={label}
                        onChange={(event) => setLabel(event.target.value)}
                        placeholder="Например: Да, Нет, Успех, Ошибка"
                        autoFocus
                    />
                </label>

                <footer className="edge-settings-modal__footer">
                    <button
                        className="edge-settings-modal__button edge-settings-modal__button--save"
                        type="button"
                        onClick={handleSave}
                    >
                        Сохранить
                    </button>

                    <button
                        className="edge-settings-modal__button edge-settings-modal__button--clear"
                        type="button"
                        onClick={() => onSave('')}
                    >
                        Очистить
                    </button>

                    <button
                        className="edge-settings-modal__button edge-settings-modal__button--cancel"
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

export default EdgeSettingsModal;

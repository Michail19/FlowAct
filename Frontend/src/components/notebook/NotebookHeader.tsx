import { Link } from 'react-router-dom';
import { type FocusEvent, useState } from 'react';

import NotebookIconButton from './NotebookIconButton';
import type { NotebookZoomValue } from './notebookTypes';

import './NotebookHeader.css';
import NotebookSvgIcon from "./NotebookSvgIcon";

type NotebookHeaderProps = {
    isMobile: boolean;
    title: string;
    updatedAt?: string;
    onRename?: (title: string) => void;
    onSave?: () => void;
    isSaving?: boolean;
    isInterfaceHidden?: boolean;
    onToggleInterface?: () => void;
    zoomValue?: NotebookZoomValue;
    onZoomChange?: (zoomValue: NotebookZoomValue) => void;
};

function formatUpdatedAt(updatedAt?: string) {
    if (!updatedAt) {
        return 'ещё не сохранён';
    }

    return `изменён ${new Date(updatedAt).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })}`;
}

function NotebookHeader({
                            isMobile,
                            title,
                            updatedAt,
                            onRename,
                            onSave,
                            isSaving = false,
                            isInterfaceHidden = false,
                            onToggleInterface,
                            zoomValue = '100',
                            onZoomChange,
                        }: NotebookHeaderProps) {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [draftTitle, setDraftTitle] = useState(title);

    const handleStartRename = () => {
        setDraftTitle(title);
        setIsEditingTitle(true);
    };

    const handleCancelRename = () => {
        setDraftTitle(title);
        setIsEditingTitle(false);
    };

    const handleSaveRename = () => {
        const normalizedTitle = draftTitle.trim() || 'Без названия';

        onRename?.(normalizedTitle);
        setIsEditingTitle(false);
    };

    const handleTitleEditBlur = (event: FocusEvent<HTMLDivElement>) => {
        const nextFocusedElement = event.relatedTarget;

        if (
            nextFocusedElement instanceof Node &&
            event.currentTarget.contains(nextFocusedElement)
        ) {
            return;
        }

        handleSaveRename();
    };

    return (
        <header className="notebook-header">
            <div className="notebook-header__left">
                <NotebookIconButton
                    icon={isInterfaceHidden ? 'focus' : 'more'}
                    label={
                        isInterfaceHidden
                            ? 'Показать интерфейс редактора'
                            : 'Скрыть интерфейс редактора'
                    }
                    className="notebook-header__menu-button"
                    active={isInterfaceHidden}
                    onClick={onToggleInterface}
                />

                {isMobile ? (
                    <Link to="/home" className="notebook-header__home-link" aria-label="На главную">
                        <NotebookSvgIcon name="home" />
                    </Link>
                ) : (
                    <label className="notebook-header__zoom">
                        <span className="notebook-header__zoom-label">Масштаб</span>
                        <select
                            className="notebook-header__zoom-select"
                            value={zoomValue}
                            title="Масштаб"
                            onChange={(event) =>
                                onZoomChange?.(event.target.value as NotebookZoomValue)
                            }
                        >
                            <option value="auto">Авто</option>
                            <option value="75">75%</option>
                            <option value="100">100%</option>
                            <option value="125">125%</option>
                            <option value="150">150%</option>
                        </select>
                    </label>
                )}

                {!isMobile && !isInterfaceHidden && (
                    <NotebookIconButton
                        icon={isSaving ? 'loading' : 'save'}
                        label={isSaving ? 'Сохранение...' : 'Сохранить notebook'}
                        active
                        onClick={onSave}
                        disabled={isSaving}
                    />
                )}
            </div>

            <div className="notebook-header__title-wrap">
                {isEditingTitle ? (
                    <div
                        className="notebook-header__title-edit"
                        onBlur={handleTitleEditBlur}
                    >
                        <input
                            className="notebook-header__title-input"
                            value={draftTitle}
                            onChange={(event) => setDraftTitle(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    handleSaveRename();
                                }

                                if (event.key === 'Escape') {
                                    handleCancelRename();
                                }
                            }}
                            autoFocus
                        />

                        <button
                            className="notebook-header__title-save"
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={handleSaveRename}
                        >
                            ✓
                        </button>
                    </div>
                ) : (
                    <button
                        className="notebook-header__title"
                        type="button"
                        onClick={handleStartRename}
                    >
                        <span className="notebook-header__title-text">{title}</span>
                        <span className="notebook-header__subtitle">
                            {formatUpdatedAt(updatedAt)}
                        </span>
                    </button>
                )}
            </div>

            <div className="notebook-header__right">
                {!isMobile && (
                    <Link to="/home" className="notebook-header__home-link">
                        ⌂
                    </Link>
                )}

                <Link to="/my-account" className="notebook-header__profile-link" aria-label="Профиль">
                    <NotebookSvgIcon name="user" />
                </Link>
            </div>
        </header>
    );
}

export default NotebookHeader;

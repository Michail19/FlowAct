import NotebookIconButton from './NotebookIconButton';

import './NotebookHeader.css';

type NotebookHeaderProps = {
    isMobile: boolean;
    onSave?: () => void;
    isSaving?: boolean;
};

function NotebookHeader({ isMobile, onSave, isSaving = false }: NotebookHeaderProps) {
    return (
        <header className="notebook-header">
            <div className="notebook-header__left">
                {!isMobile && (
                    <NotebookIconButton
                        icon="⠿"
                        label="Открыть меню блоков"
                        className="notebook-header__menu-button"
                    />
                )}

                {isMobile ? (
                    <NotebookIconButton icon="⌂" label="На главную" />
                ) : (
                    <label className="notebook-header__zoom">
                        <span className="notebook-header__zoom-label">Масштаб</span>
                        <select className="notebook-header__zoom-select" defaultValue="100">
                            <option value="75">75%</option>
                            <option value="100">100%</option>
                            <option value="125">125%</option>
                            <option value="150">150%</option>
                        </select>
                    </label>
                )}

                {!isMobile && (
                    <NotebookIconButton
                        icon={isSaving ? '…' : '💾'}
                        label={isSaving ? 'Сохранение...' : 'Сохранить notebook'}
                        active
                        onClick={onSave}
                        disabled={isSaving}
                    />
                )}
            </div>

            <div className="notebook-header__title-wrap">
                <button className="notebook-header__title" type="button">
                    <span className="notebook-header__title-text">Название notebook</span>
                    <span className="notebook-header__subtitle">дата и время последнего изменения</span>
                </button>
            </div>

            <div className="notebook-header__right">
                {!isMobile && <NotebookIconButton icon="⌂" label="На главную" />}
                <NotebookIconButton icon="◕" label="Профиль пользователя" variant="circle" />
            </div>
        </header>
    );
}

export default NotebookHeader;

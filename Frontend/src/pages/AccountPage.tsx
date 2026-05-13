import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { authApi } from '../services/authApi';
import { ApiError } from '../services/apiClient';
import NotebookSvgIcon from '../components/notebook/NotebookSvgIcon';

import './AccountPage.css';

function getInitials(displayName?: string | null, email?: string | null) {
    const source = displayName?.trim() || email?.trim() || 'U';
    const parts = source.split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return source.slice(0, 2).toUpperCase();
}

function getErrorMessage(error: unknown) {
    if (error instanceof ApiError) {
        return 'Не удалось сохранить изменения. Проверьте данные и попробуйте ещё раз.';
    }

    return 'Не удалось подключиться к серверу.';
}

function AccountPage() {
    const navigate = useNavigate();
    const { user, logout, refreshUser } = useAuth();

    const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null);
    const [isPasswordSectionOpen, setIsPasswordSectionOpen] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [repeatPassword, setRepeatPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const displayName = displayNameDraft ?? user?.displayName ?? '';

    const initials = useMemo(
        () => getInitials(user?.displayName, user?.email),
        [user?.displayName, user?.email],
    );

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMessage(null);
        setErrorMessage(null);

        if (isPasswordSectionOpen && (oldPassword || newPassword || repeatPassword)) {
            setErrorMessage('Смена пароля пока не подключена на backend. Сохраните профиль без пароля.');
            return;
        }

        setIsSaving(true);

        try {
            await authApi.updateCurrentUser({
                displayName: displayName.trim() || null,
            });
            await refreshUser();
            setDisplayNameDraft(null);
            setMessage('Изменения сохранены.');
        } catch (error) {
            setErrorMessage(getErrorMessage(error));
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);

        try {
            await logout();
            navigate('/landing');
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <main className="account-page">
            <section className="account-page__shell">
                <header className="account-page__topbar">
                    <Link className="account-page__brand" to="/home">
                        FlowAct
                    </Link>

                    <div className="account-page__topbar-actions">
                        <Link className="account-page__nav-link" to="/home">
                            Notebook
                        </Link>

                        <button
                            className="account-page__profile"
                            type="button"
                            aria-label="Текущий профиль"
                            title={user?.email ?? 'Профиль'}
                        >
                            <NotebookSvgIcon name="user" size={18} />
                        </button>
                    </div>
                </header>

                <form className="account-page__content" onSubmit={handleSubmit}>
                    <section className="account-page__form-panel">
                        <div className="account-page__heading">
                            <span>Account settings</span>
                            <h1>Настройки</h1>
                        </div>

                        <div className="account-page__mobile-avatar">
                            <div className="account-page__avatar account-page__avatar--small">
                                <span>{initials}</span>
                            </div>
                        </div>

                        <div className="account-page__fields">
                            <label className="account-page__field">
                                <span>Имя / display name</span>
                                <input
                                    value={displayName}
                                    onChange={(event) => setDisplayNameDraft(event.target.value)}
                                    placeholder="Как отображать ваше имя"
                                    maxLength={255}
                                />
                            </label>

                            <label className="account-page__field">
                                <span>Email</span>
                                <input value={user?.email ?? ''} readOnly />
                            </label>

                            <label className="account-page__field">
                                <span>Username</span>
                                <input value={user?.email?.split('@')[0] ?? ''} readOnly />
                            </label>

                            <div className="account-page__grid-fields">
                                <label className="account-page__field">
                                    <span>Роль</span>
                                    <input value={user?.role ?? 'USER'} readOnly />
                                </label>

                                <label className="account-page__field">
                                    <span>Статус</span>
                                    <input value={user?.status ?? 'ACTIVE'} readOnly />
                                </label>
                            </div>

                            <section className="account-page__password-card">
                                <button
                                    className="account-page__password-toggle"
                                    type="button"
                                    onClick={() => setIsPasswordSectionOpen((value) => !value)}
                                >
                                    <span>Сменить пароль</span>
                                    <span aria-hidden="true">{isPasswordSectionOpen ? '⌃' : '⌄'}</span>
                                </button>

                                {isPasswordSectionOpen && (
                                    <div className="account-page__password-fields">
                                        <input
                                            type="password"
                                            placeholder="Старый пароль"
                                            value={oldPassword}
                                            onChange={(event) => setOldPassword(event.target.value)}
                                            autoComplete="current-password"
                                        />
                                        <input
                                            type="password"
                                            placeholder="Новый пароль"
                                            value={newPassword}
                                            onChange={(event) => setNewPassword(event.target.value)}
                                            autoComplete="new-password"
                                        />
                                        <input
                                            type="password"
                                            placeholder="Повторите новый пароль"
                                            value={repeatPassword}
                                            onChange={(event) => setRepeatPassword(event.target.value)}
                                            autoComplete="new-password"
                                        />
                                    </div>
                                )}
                            </section>
                        </div>
                    </section>

                    <aside className="account-page__side-panel">
                        <div className="account-page__avatar">
                            <span>{initials}</span>
                        </div>

                        <p className="account-page__profile-name">
                            {user?.displayName || user?.email || 'Пользователь'}
                        </p>

                        <p className="account-page__profile-email">
                            {user?.email}
                        </p>

                        <button
                            className="account-page__avatar-button"
                            type="button"
                            disabled
                            title="Загрузка аватара будет добавлена позже"
                        >
                            Редактировать
                        </button>
                    </aside>

                    <footer className="account-page__actions">
                        <div className="account-page__status-messages">
                            {message && <p className="account-page__message">{message}</p>}
                            {errorMessage && <p className="account-page__error">{errorMessage}</p>}
                        </div>

                        <div className="account-page__buttons">
                            <button
                                className="account-page__logout-button"
                                type="button"
                                onClick={handleLogout}
                                disabled={isLoggingOut}
                            >
                                {isLoggingOut ? 'Выход...' : 'Выйти'}
                            </button>

                            <button
                                className="account-page__save-button"
                                type="submit"
                                disabled={isSaving}
                            >
                                {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
                            </button>
                        </div>
                    </footer>
                </form>
            </section>
        </main>
    );
}

export default AccountPage;

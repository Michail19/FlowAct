import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { authApi } from '../services/authApi';
import { profileApi } from '../services/profileApi';
import { ApiError } from '../services/apiClient';
import NotebookSvgIcon from '../components/notebook/NotebookSvgIcon';
import { UserAvatar } from '../components/user/UserAvatar';

import './AccountPage.css';
import './AccountAvatarUx.css';

const MAX_AVATAR_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const AVATAR_IMAGE_SIZE = 320;

function getErrorMessage(error: unknown) {
    if (error instanceof ApiError) {
        if (error.status === 401) {
            return 'Текущий пароль указан неверно.';
        }

        if (error.status === 400) {
            return 'Проверьте заполненные поля. Для аватара выберите корректное изображение.';
        }

        return 'Не удалось сохранить изменения. Проверьте данные и попробуйте ещё раз.';
    }

    return 'Не удалось подключиться к серверу.';
}

function getDefaultUsername(email?: string | null) {
    return email?.split('@')[0]?.trim() || '';
}

function isValidUsername(value: string) {
    const normalizedValue = value.trim();

    return /^[a-zA-Z0-9._-]{2,64}$/.test(normalizedValue);
}

function isValidAvatarSource(value: string) {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
        return true;
    }

    return (
        normalizedValue.startsWith('http://') ||
        normalizedValue.startsWith('https://') ||
        normalizedValue.startsWith('data:image/')
    );
}

function loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();

        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Не удалось прочитать изображение.'));
        image.src = src;
    });
}

async function resizeAvatarFile(file: File) {
    if (!file.type.startsWith('image/')) {
        throw new Error('Выберите файл изображения.');
    }

    if (file.size > MAX_AVATAR_FILE_SIZE_BYTES) {
        throw new Error('Размер изображения не должен превышать 2 МБ.');
    }

    const originalDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
        reader.readAsDataURL(file);
    });
    const image = await loadImage(originalDataUrl);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('Не удалось подготовить изображение.');
    }

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = (image.naturalWidth - sourceSize) / 2;
    const sourceY = (image.naturalHeight - sourceSize) / 2;

    canvas.width = AVATAR_IMAGE_SIZE;
    canvas.height = AVATAR_IMAGE_SIZE;
    context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        AVATAR_IMAGE_SIZE,
        AVATAR_IMAGE_SIZE,
    );

    return canvas.toDataURL('image/webp', 0.82);
}

function AccountPage() {
    const navigate = useNavigate();
    const { user, logout, refreshUser } = useAuth();
    const avatarInputRef = useRef<HTMLInputElement | null>(null);

    const [usernameDraft, setUsernameDraft] = useState<string | null>(null);
    const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null);
    const [avatarUrlDraft, setAvatarUrlDraft] = useState<string | null>(null);
    const [isPasswordSectionOpen, setIsPasswordSectionOpen] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [repeatPassword, setRepeatPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isAvatarProcessing, setIsAvatarProcessing] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const username = usernameDraft ?? user?.username ?? getDefaultUsername(user?.email);
    const displayName = displayNameDraft ?? user?.displayName ?? '';
    const avatarUrl = avatarUrlDraft ?? user?.avatarUrl ?? '';
    const avatarPreviewUrl = isValidAvatarSource(avatarUrl) ? avatarUrl.trim() : null;
    const isCredentialsUpdateRequested = Boolean(oldPassword || newPassword || repeatPassword);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMessage(null);
        setErrorMessage(null);

        if (!isValidUsername(username)) {
            setErrorMessage('Username должен содержать 2–64 символа: латиница, цифры, точка, дефис или подчёркивание.');
            return;
        }

        if (!isValidAvatarSource(avatarUrl)) {
            setErrorMessage('Аватар должен быть ссылкой http/https или выбранным изображением.');
            return;
        }

        if (isCredentialsUpdateRequested) {
            if (!oldPassword || !newPassword || !repeatPassword) {
                setErrorMessage('Заполните старый пароль, новый пароль и повтор нового пароля.');
                return;
            }

            if (newPassword !== repeatPassword) {
                setErrorMessage('Новый пароль и повтор нового пароля не совпадают.');
                return;
            }

            if (newPassword.length < 8) {
                setErrorMessage('Минимальная длина нового пароля — 8 символов.');
                return;
            }
        }

        setIsSaving(true);

        try {
            await profileApi.updateCurrentUser({
                username: username.trim() || null,
                displayName: displayName.trim() || null,
                avatarUrl: avatarUrl.trim() || null,
            });

            if (isCredentialsUpdateRequested) {
                await authApi.updateCredentials({
                    currentSecret: oldPassword,
                    newSecret: newPassword,
                });

                setMessage('Пароль изменён. Выполните вход заново.');
                await logout();
                navigate('/landing');
                return;
            }

            await refreshUser();
            setUsernameDraft(null);
            setDisplayNameDraft(null);
            setAvatarUrlDraft(null);
            setMessage('Изменения сохранены.');
        } catch (error) {
            setErrorMessage(getErrorMessage(error));
        } finally {
            setIsSaving(false);
        }
    };

    const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        setMessage(null);
        setErrorMessage(null);
        setIsAvatarProcessing(true);

        try {
            const resizedAvatar = await resizeAvatarFile(file);

            setAvatarUrlDraft(resizedAvatar);
            setMessage('Фото выбрано. Нажмите «Сохранить изменения», чтобы применить его к профилю.');
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить фото.');
        } finally {
            setIsAvatarProcessing(false);

            if (avatarInputRef.current) {
                avatarInputRef.current.value = '';
            }
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
                            <UserAvatar
                                displayName={displayName}
                                email={user?.email}
                                avatarUrl={avatarPreviewUrl}
                                size="lg"
                            />
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
                                <input
                                    value={username}
                                    onChange={(event) => setUsernameDraft(event.target.value)}
                                    placeholder="username"
                                    maxLength={64}
                                />
                                <small className="account-page__field-hint">
                                    По умолчанию используется часть email до @. Можно изменить.
                                </small>
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

                            <input
                                ref={avatarInputRef}
                                className="account-page__avatar-input"
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/gif"
                                onChange={handleAvatarChange}
                            />

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
                        <UserAvatar
                            displayName={displayName}
                            email={user?.email}
                            avatarUrl={avatarPreviewUrl}
                            size="xl"
                        />

                        <p className="account-page__profile-name">
                            {displayName || username || user?.email || 'Пользователь'}
                        </p>

                        <p className="account-page__profile-email">
                            {user?.email}
                        </p>

                        <button
                            className="account-page__avatar-button"
                            type="button"
                            onClick={() => avatarInputRef.current?.click()}
                            disabled={isAvatarProcessing}
                        >
                            {isAvatarProcessing ? 'Обработка...' : 'Редактировать фото'}
                        </button>

                        {avatarUrl && (
                            <button
                                className="account-page__avatar-remove-button"
                                type="button"
                                onClick={() => setAvatarUrlDraft('')}
                                disabled={isAvatarProcessing}
                            >
                                Удалить фото
                            </button>
                        )}

                        <p className="account-page__avatar-hint">
                            PNG, JPG, WEBP или GIF до 2 МБ. Фото будет сжато до 320×320.
                        </p>
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
                                disabled={isSaving || isAvatarProcessing}
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

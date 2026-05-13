import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../../services/apiClient';
import { useAuth } from '../../auth/AuthProvider';

import './AuthModal.css';

export type AuthMode = 'login' | 'registration';

type AuthModalProps = {
    mode: AuthMode;
    onClose: () => void;
    onSwitchMode: (mode: AuthMode) => void;
};

function getErrorMessage(error: unknown) {
    if (error instanceof ApiError) {
        if (error.status === 409) {
            return 'Пользователь с таким email уже существует.';
        }

        if (error.status === 401) {
            return 'Неверный email или пароль.';
        }

        return 'Не удалось выполнить запрос. Попробуйте ещё раз.';
    }

    return 'Не удалось подключиться к серверу.';
}

export function AuthModal({ mode, onClose, onSwitchMode }: AuthModalProps) {
    const navigate = useNavigate();
    const { login, register } = useAuth();

    const isLogin = mode === 'login';

    const [email, setEmail] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [password, setPassword] = useState('');
    const [repeatPassword, setRepeatPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setErrorMessage(null);

        if (!isLogin && password !== repeatPassword) {
            setErrorMessage('Пароли не совпадают.');
            return;
        }

        setIsSubmitting(true);

        try {
            if (isLogin) {
                await login({ email, password });
            } else {
                await register({
                    email,
                    password,
                    displayName: displayName.trim() || null,
                });
            }

            onClose();
            navigate('/home');
        } catch (error) {
            setErrorMessage(getErrorMessage(error));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="auth-modal" role="presentation" onMouseDown={onClose}>
            <section
                className="auth-modal__card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="auth-modal-title"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="auth-modal__header">
                    <div>
                        <span className="auth-modal__eyebrow">
                            {isLogin ? 'Login' : 'Registration'}
                        </span>
                        <h2 id="auth-modal-title">
                            {isLogin ? 'Вход в FlowAct' : 'Создание аккаунта'}
                        </h2>
                        <p>
                            Войдите, чтобы создавать notebook, запускать рабочие процессы и
                            хранить результаты выполнения.
                        </p>
                    </div>

                    <button
                        className="auth-modal__close"
                        type="button"
                        aria-label="Закрыть окно"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </header>

                <div className="auth-modal__mode-switch" role="tablist" aria-label="Режим авторизации">
                    <button
                        type="button"
                        className={isLogin ? 'auth-modal__mode auth-modal__mode--active' : 'auth-modal__mode'}
                        onClick={() => onSwitchMode('login')}
                    >
                        Вход
                    </button>
                    <button
                        type="button"
                        className={!isLogin ? 'auth-modal__mode auth-modal__mode--active' : 'auth-modal__mode'}
                        onClick={() => onSwitchMode('registration')}
                    >
                        Регистрация
                    </button>
                </div>

                <form className="auth-modal__form" onSubmit={handleSubmit}>
                    <label>
                        <span>Email</span>
                        <input
                            type="email"
                            placeholder="user@example.com"
                            autoComplete="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />
                    </label>

                    {!isLogin && (
                        <label>
                            <span>Имя</span>
                            <input
                                placeholder="Михаил"
                                autoComplete="name"
                                value={displayName}
                                onChange={(event) => setDisplayName(event.target.value)}
                            />
                        </label>
                    )}

                    <label>
                        <span>Пароль</span>
                        <input
                            type="password"
                            placeholder="••••••••"
                            autoComplete={isLogin ? 'current-password' : 'new-password'}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            minLength={8}
                            required
                        />
                    </label>

                    {!isLogin && (
                        <label>
                            <span>Повторите пароль</span>
                            <input
                                type="password"
                                placeholder="••••••••"
                                autoComplete="new-password"
                                value={repeatPassword}
                                onChange={(event) => setRepeatPassword(event.target.value)}
                                minLength={8}
                                required
                            />
                        </label>
                    )}

                    {errorMessage && (
                        <p className="auth-modal__error" role="alert">
                            {errorMessage}
                        </p>
                    )}

                    <button className="auth-modal__submit" type="submit" disabled={isSubmitting}>
                        {isSubmitting
                            ? 'Отправка...'
                            : isLogin
                                ? 'Войти'
                                : 'Создать аккаунт'}
                    </button>
                </form>
            </section>
        </div>
    );
}

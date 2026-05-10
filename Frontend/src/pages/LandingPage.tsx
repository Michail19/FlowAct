import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import './LandingPage.css';

type AuthMode = 'login' | 'registration';

type AuthModalState = {
    mode: AuthMode;
} | null;

const featureCards = [
    {
        title: 'Визуальные workflow',
        text: 'Собирайте рабочие процессы из блоков, соединяйте их связями и контролируйте порядок выполнения.',
        icon: '▧',
    },
    {
        title: 'AI-блоки',
        text: 'Добавляйте AI-обработку текста, генерацию ответов, классификацию и преобразование данных.',
        icon: '✦',
    },
    {
        title: 'Запуск и логи',
        text: 'Запускайте workflow, отслеживайте состояние блоков и анализируйте результат выполнения.',
        icon: '▶',
    },
];

const taskCards = [
    'Автоматизация рутинных процессов',
    'Аналитика и обработка данных',
    'Контроль выполнения сценариев',
    'Обучение и эксперименты с workflow-моделями',
];

function LandingEditorPreview() {
    return (
        <div className="landing-editor-preview" aria-label="Пример редактора workflow">
            <div className="landing-editor-preview__header">
                <span className="landing-editor-preview__dot" />
                <span className="landing-editor-preview__dot" />
                <span className="landing-editor-preview__dot" />
                <strong>Название notebook</strong>
            </div>

            <div className="landing-editor-preview__body">
                <aside className="landing-editor-preview__toolbar">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                </aside>

                <div className="landing-editor-preview__canvas">
                    <div className="landing-editor-preview__node landing-editor-preview__node--start">
                        Старт
                    </div>
                    <div className="landing-editor-preview__node landing-editor-preview__node--ai">
                        AI
                    </div>
                    <div className="landing-editor-preview__node landing-editor-preview__node--condition">
                        ?
                    </div>
                    <div className="landing-editor-preview__node landing-editor-preview__node--log">
                        Лог
                    </div>
                    <div className="landing-editor-preview__node landing-editor-preview__node--end">
                        Конец
                    </div>

                    <svg className="landing-editor-preview__lines" viewBox="0 0 560 260" aria-hidden="true">
                        <path d="M118 88 C170 88 175 88 224 88" />
                        <path d="M300 88 C350 88 354 132 392 132" />
                        <path d="M452 132 C485 132 490 132 520 132" />
                        <path d="M300 88 C345 88 350 42 390 42" />
                    </svg>
                </div>
            </div>

            <div className="landing-editor-preview__suggestion">
                <span>AI-подсказка</span>
                <strong>Добавить логирование</strong>
                <button type="button">Добавить</button>
            </div>
        </div>
    );
}

function LandingAiModels() {
    return (
        <section className="landing-ai" id="ai">
            <div className="landing-ai__visual" aria-hidden="true">
                <span className="landing-ai__orb landing-ai__orb--openai">◎</span>
                <span className="landing-ai__orb landing-ai__orb--gemini">✦</span>
                <span className="landing-ai__orb landing-ai__orb--deepseek">◆</span>
                <span className="landing-ai__orb landing-ai__orb--other">●</span>
            </div>

            <div className="landing-ai__content">
                <span className="landing-page__eyebrow">AI-интеграции</span>
                <h2>Добавляйте AI в свои процессы</h2>
                <p>
                    FlowAct подготавливается к работе с AI-блоками, рекомендациями следующего
                    действия и автодополнением схемы. Пользователь сможет собрать цепочку,
                    где нейросеть анализирует текст, формирует результат и передаёт его дальше.
                </p>
            </div>
        </section>
    );
}

function AuthModal({
                       mode,
                       onClose,
                       onSwitchMode,
                   }: {
    mode: AuthMode;
    onClose: () => void;
    onSwitchMode: (mode: AuthMode) => void;
}) {
    const navigate = useNavigate();
    const isLogin = mode === 'login';

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        // Временное поведение до подключения UserService.
        // После появления авторизации здесь будет вызов authApi.login/register.
        navigate('/home');
    };

    return (
        <div className="landing-auth" role="presentation" onMouseDown={onClose}>
            <section
                className="landing-auth__card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="landing-auth-title"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="landing-auth__header">
                    <div>
                        <span className="landing-page__eyebrow">
                            {isLogin ? 'Login' : 'Registration'}
                        </span>
                        <h2 id="landing-auth-title">
                            {isLogin ? 'Вход в аккаунт' : 'Регистрация'}
                        </h2>
                    </div>

                    <button
                        className="landing-auth__close"
                        type="button"
                        aria-label="Закрыть окно"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </header>

                <form className="landing-auth__form" onSubmit={handleSubmit}>
                    {!isLogin && (
                        <>
                            <label>
                                <span>Email</span>
                                <input type="email" placeholder="user@example.com" />
                            </label>

                            <label>
                                <span>Username</span>
                                <input placeholder="mikhail" />
                            </label>

                            <div className="landing-auth__grid">
                                <label>
                                    <span>Имя</span>
                                    <input placeholder="Михаил" />
                                </label>

                                <label>
                                    <span>Фамилия</span>
                                    <input placeholder="Ершов" />
                                </label>
                            </div>
                        </>
                    )}

                    {isLogin && (
                        <label>
                            <span>Email / Username</span>
                            <input placeholder="user@example.com" />
                        </label>
                    )}

                    <label>
                        <span>Пароль</span>
                        <input type="password" placeholder="••••••••" />
                    </label>

                    {!isLogin && (
                        <label>
                            <span>Повторите пароль</span>
                            <input type="password" placeholder="••••••••" />
                        </label>
                    )}

                    <button className="landing-auth__submit" type="submit">
                        {isLogin ? 'Войти' : 'Зарегистрироваться'}
                    </button>
                </form>

                <button
                    className="landing-auth__switch"
                    type="button"
                    onClick={() => onSwitchMode(isLogin ? 'registration' : 'login')}
                >
                    {isLogin
                        ? 'Нет аккаунта? Зарегистрироваться'
                        : 'Уже есть аккаунт? Войти'}
                </button>

                <p className="landing-auth__hint">
                    Форма подготовлена под будущий UserService. Сейчас переход выполняется
                    в demo-режим.
                </p>
            </section>
        </div>
    );
}

function LandingPage() {
    const [authModal, setAuthModal] = useState<AuthModalState>(null);

    const openAuthModal = (mode: AuthMode) => {
        setAuthModal({ mode });
    };

    const closeAuthModal = () => {
        setAuthModal(null);
    };

    const switchAuthMode = (mode: AuthMode) => {
        setAuthModal({ mode });
    };

    return (
        <main className="landing-page">
            <section className="landing-page__shell">
                <header className="landing-page__topbar">
                    <Link className="landing-page__brand" to="/landing">
                        FlowAct
                    </Link>

                    <nav className="landing-page__nav" aria-label="Навигация по лендингу">
                        <a href="#about">Что такое FlowAct?</a>
                        <a href="#features">Преимущества</a>
                        <a href="#tasks">Задачи</a>
                    </nav>

                    <div className="landing-page__actions">
                        <button
                            className="landing-page__ghost-button"
                            type="button"
                            onClick={() => openAuthModal('registration')}
                        >
                            Регистрация
                        </button>

                        <button
                            className="landing-page__login-button"
                            type="button"
                            onClick={() => openAuthModal('login')}
                        >
                            Войти
                        </button>
                    </div>
                </header>

                <section className="landing-hero" id="about">
                    <div className="landing-hero__content">
                        <span className="landing-page__eyebrow">Workflow automation</span>

                        <h1>
                            FlowAct — визуальные workflow для автоматизации задач
                        </h1>

                        <p>
                            Создавайте, запускайте и контролируйте цепочки действий без кода:
                            от простых сценариев до AI-процессов, HTTP-запросов и анализа
                            результатов.
                        </p>

                        <div className="landing-hero__buttons">
                            <Link className="landing-page__primary-button" to="/home">
                                Начать работу
                            </Link>

                            <a className="landing-page__secondary-button" href="#preview">
                                Посмотреть пример
                            </a>
                        </div>
                    </div>

                    <div className="landing-hero__preview" id="preview">
                        <LandingEditorPreview />
                    </div>
                </section>

                <section className="landing-features" id="features">
                    {featureCards.map((feature) => (
                        <article className="landing-feature-card" key={feature.title}>
                            <span className="landing-feature-card__icon" aria-hidden="true">
                                {feature.icon}
                            </span>
                            <h2>{feature.title}</h2>
                            <p>{feature.text}</p>
                        </article>
                    ))}
                </section>

                <LandingAiModels />

                <section className="landing-run">
                    <div className="landing-run__content">
                        <span className="landing-page__eyebrow">Execution</span>
                        <h2>Запускайте, отслеживайте, анализируйте</h2>
                        <p>
                            Запускайте отдельные блоки или весь workflow целиком. Состояние
                            каждого шага отображается в редакторе, а логи и итоговый результат
                            помогают быстро понять, где процесс завершился успешно, а где нужна
                            настройка.
                        </p>
                    </div>

                    <div className="landing-run__panel" aria-hidden="true">
                        <div className="landing-run__panel-header">
                            <span>Выполнение</span>
                            <strong>Выполнено</strong>
                        </div>

                        <div className="landing-run__log landing-run__log--success">
                            <span>12:04:18</span>
                            <p>Стартовый блок выполнен</p>
                        </div>

                        <div className="landing-run__log landing-run__log--success">
                            <span>12:04:19</span>
                            <p>AI-блок вернул результат</p>
                        </div>

                        <div className="landing-run__log landing-run__log--info">
                            <span>12:04:20</span>
                            <p>Workflow завершён</p>
                        </div>
                    </div>
                </section>

                <section className="landing-tasks" id="tasks">
                    <div className="landing-tasks__header">
                        <span className="landing-page__eyebrow">Use cases</span>
                        <h2>Подходит для разных задач</h2>
                    </div>

                    <div className="landing-tasks__grid">
                        {taskCards.map((task) => (
                            <article className="landing-task-card" key={task}>
                                <span>✓</span>
                                <p>{task}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="landing-cta">
                    <h2>Начните создавать свой первый workflow</h2>
                    <p>
                        Регистрация займёт меньше минуты. Сейчас можно открыть demo-режим и
                        проверить редактор без подключения UserService.
                    </p>

                    <div className="landing-cta__actions">
                        <Link className="landing-page__primary-button landing-page__primary-button--large" to="/home">
                            Начать работу
                        </Link>

                        <button
                            className="landing-page__secondary-button"
                            type="button"
                            onClick={() => openAuthModal('registration')}
                        >
                            Зарегистрироваться
                        </button>
                    </div>
                </section>

                <footer className="landing-footer">
                    <span>FlowAct 2026</span>
                    <Link to="/home">Перейти к notebook</Link>
                </footer>
            </section>

            {authModal && (
                <AuthModal
                    mode={authModal.mode}
                    onClose={closeAuthModal}
                    onSwitchMode={switchAuthMode}
                />
            )}
        </main>
    );
}

export default LandingPage;

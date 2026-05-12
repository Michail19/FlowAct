import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import './LandingPage.css';

type AuthMode = 'login' | 'registration';

type AuthModalState = {
    mode: AuthMode;
} | null;

const heroHighlights = [
    'Визуальный редактор без лишней настройки',
    'Запуск workflow и понятные логи выполнения',
    'Подготовка под AI-рекомендации и автодополнение',
];

const statsCards = [
    {
        value: '3 шага',
        label: 'создать notebook, добавить блоки, запустить workflow',
    },
    {
        value: '0 кода',
        label: 'сценарии собираются связями между блоками',
    },
    {
        value: 'Demo',
        label: 'можно открыть редактор до подключения UserService',
    },
];

const featureCards = [
    {
        title: 'Понятная сборка схемы',
        text: 'Перетаскивайте блоки, соединяйте их ветками и сразу видьте порядок выполнения процесса.',
        icon: '▧',
    },
    {
        title: 'Контроль результата',
        text: 'Запускайте workflow, отслеживайте статусы блоков и открывайте логи, если нужно найти ошибку.',
        icon: '▶',
    },
    {
        title: 'AI-ready подход',
        text: 'AI-блоки и рекомендации помогают готовить процессы для анализа текста, генерации и автодополнения.',
        icon: '✦',
    },
];

const workflowSteps = [
    {
        step: '01',
        title: 'Создайте notebook',
        text: 'Notebook хранит схему рабочего процесса, связи, настройки блоков и состояние выполнения.',
    },
    {
        step: '02',
        title: 'Соберите workflow',
        text: 'Добавьте старт, действия, условия, AI-блоки, HTTP-запросы, логирование и финальный блок.',
    },
    {
        step: '03',
        title: 'Запустите и проверьте',
        text: 'FlowAct покажет статусы блоков, сохранит execution logs и поможет понять итог выполнения.',
    },
];

const taskCards = [
    {
        title: 'Автоматизация рутины',
        text: 'Собирайте повторяемые цепочки действий и запускайте их из одного интерфейса.',
    },
    {
        title: 'AI-обработка текста',
        text: 'Готовьте сценарии, где модель анализирует текст, формирует вывод и передаёт его дальше.',
    },
    {
        title: 'Интеграции через HTTP',
        text: 'Добавляйте запросы к внешним API и используйте ответ в следующих блоках процесса.',
    },
    {
        title: 'Отладка процессов',
        text: 'Проверяйте схему, смотрите логи и быстро находите место, где workflow требует настройки.',
    },
];

const shortcutCards = [
    {
        keys: 'Ctrl + S',
        action: 'сохранить notebook',
    },
    {
        keys: 'Ctrl + Z',
        action: 'отменить действие',
    },
    {
        keys: 'Ctrl + Enter',
        action: 'запустить workflow',
    },
];

function LandingEditorPreview() {
    return (
        <div className="landing-editor-preview" aria-label="Пример редактора workflow">
            <div className="landing-editor-preview__header">
                <div className="landing-editor-preview__window-actions" aria-hidden="true">
                    <span className="landing-editor-preview__dot" />
                    <span className="landing-editor-preview__dot" />
                    <span className="landing-editor-preview__dot" />
                </div>

                <strong>Заявка клиента</strong>

                <span className="landing-editor-preview__status">Сохранено</span>
            </div>

            <div className="landing-editor-preview__body">
                <aside className="landing-editor-preview__toolbar" aria-hidden="true">
                    <span title="Старт" />
                    <span title="AI" />
                    <span title="Условие" />
                    <span title="HTTP" />
                    <span title="Лог" />
                    <span title="Конец" />
                </aside>

                <div className="landing-editor-preview__canvas">
                    <div className="landing-editor-preview__node landing-editor-preview__node--start">
                        Старт
                    </div>
                    <div className="landing-editor-preview__node landing-editor-preview__node--ai">
                        AI-анализ
                    </div>
                    <div className="landing-editor-preview__node landing-editor-preview__node--condition">
                        IF
                    </div>
                    <div className="landing-editor-preview__node landing-editor-preview__node--log">
                        Лог
                    </div>
                    <div className="landing-editor-preview__node landing-editor-preview__node--end">
                        Конец
                    </div>

                    <span className="landing-editor-preview__branch landing-editor-preview__branch--yes">
                        Да
                    </span>
                    <span className="landing-editor-preview__branch landing-editor-preview__branch--no">
                        Нет
                    </span>

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
                <strong>Добавить логирование ответа</strong>
                <button type="button">Добавить</button>
            </div>
        </div>
    );
}

function LandingAiModels() {
    return (
        <section className="landing-ai" id="ai">
            <div className="landing-ai__visual" aria-hidden="true">
                <span className="landing-ai__orb landing-ai__orb--openai">AI</span>
                <span className="landing-ai__orb landing-ai__orb--gemini">✦</span>
                <span className="landing-ai__orb landing-ai__orb--deepseek">ML</span>
                <span className="landing-ai__orb landing-ai__orb--other">API</span>
            </div>

            <div className="landing-ai__content">
                <span className="landing-page__eyebrow">AI-интеграции</span>
                <h2>AI становится частью процесса, а не отдельным окном</h2>
                <p>
                    FlowAct готовится к сценариям, где модель получает данные из предыдущего
                    блока, анализирует их и передаёт результат дальше по схеме. Это удобно для
                    классификации, генерации текста, проверки условий и автоматических подсказок.
                </p>

                <div className="landing-ai__chips" aria-label="Возможности AI-блоков">
                    <span>Анализ текста</span>
                    <span>Генерация ответа</span>
                    <span>Рекомендация блока</span>
                </div>
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

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
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
                            {isLogin ? 'Вход в FlowAct' : 'Создание аккаунта'}
                        </h2>
                        <p>
                            Сейчас форма работает как demo-переход. После подключения UserService
                            здесь появится полноценная авторизация.
                        </p>
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

                <div className="landing-auth__mode-switch" role="tablist" aria-label="Режим авторизации">
                    <button
                        type="button"
                        className={isLogin ? 'landing-auth__mode landing-auth__mode--active' : 'landing-auth__mode'}
                        onClick={() => onSwitchMode('login')}
                    >
                        Вход
                    </button>
                    <button
                        type="button"
                        className={!isLogin ? 'landing-auth__mode landing-auth__mode--active' : 'landing-auth__mode'}
                        onClick={() => onSwitchMode('registration')}
                    >
                        Регистрация
                    </button>
                </div>

                <form className="landing-auth__form" onSubmit={handleSubmit}>
                    {!isLogin && (
                        <>
                            <label>
                                <span>Email</span>
                                <input type="email" placeholder="user@example.com" autoComplete="email" />
                            </label>

                            <label>
                                <span>Username</span>
                                <input placeholder="mikhail" autoComplete="username" />
                            </label>

                            <div className="landing-auth__grid">
                                <label>
                                    <span>Имя</span>
                                    <input placeholder="Михаил" autoComplete="given-name" />
                                </label>

                                <label>
                                    <span>Фамилия</span>
                                    <input placeholder="Ершов" autoComplete="family-name" />
                                </label>
                            </div>
                        </>
                    )}

                    {isLogin && (
                        <label>
                            <span>Email / Username</span>
                            <input placeholder="user@example.com" autoComplete="username" />
                        </label>
                    )}

                    <label>
                        <span>Пароль</span>
                        <input type="password" placeholder="••••••••" autoComplete={isLogin ? 'current-password' : 'new-password'} />
                    </label>

                    {!isLogin && (
                        <label>
                            <span>Повторите пароль</span>
                            <input type="password" placeholder="••••••••" autoComplete="new-password" />
                        </label>
                    )}

                    <button className="landing-auth__submit" type="submit">
                        {isLogin ? 'Войти в demo' : 'Продолжить в demo'}
                    </button>
                </form>

                <p className="landing-auth__hint">
                    Пока UserService не подключён, FlowAct использует временный demo-пользователь
                    и позволяет сразу перейти к созданию notebook.
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
                        <span className="landing-page__brand-mark">F</span>
                        FlowAct
                    </Link>

                    <nav className="landing-page__nav" aria-label="Навигация по лендингу">
                        <a href="#features">Возможности</a>
                        <a href="#how-it-works">Как работает</a>
                        <a href="#ai">AI</a>
                        <a href="#tasks">Сценарии</a>
                    </nav>

                    <div className="landing-page__actions">
                        <button
                            className="landing-page__ghost-button"
                            type="button"
                            onClick={() => openAuthModal('login')}
                        >
                            Войти
                        </button>

                        <button
                            className="landing-page__login-button"
                            type="button"
                            onClick={() => openAuthModal('registration')}
                        >
                            Попробовать
                        </button>
                    </div>
                </header>

                <section className="landing-hero" id="about">
                    <div className="landing-hero__content">
                        <span className="landing-page__eyebrow">Workflow automation</span>

                        <h1>
                            Собирайте рабочие процессы так же просто, как схему на доске
                        </h1>

                        <p>
                            FlowAct помогает визуально собрать цепочку действий, запустить её,
                            увидеть результат каждого блока и постепенно добавить AI-логику без
                            ручного связывания сервисов.
                        </p>

                        <div className="landing-hero__buttons">
                            <Link className="landing-page__primary-button" to="/home">
                                Открыть demo-редактор
                            </Link>

                            <a className="landing-page__secondary-button" href="#how-it-works">
                                Как это работает
                            </a>
                        </div>

                        <ul className="landing-hero__highlights" aria-label="Ключевые преимущества">
                            {heroHighlights.map((highlight) => (
                                <li key={highlight}>{highlight}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="landing-hero__preview" id="preview">
                        <LandingEditorPreview />
                    </div>
                </section>

                <section className="landing-stats" aria-label="Кратко о FlowAct">
                    {statsCards.map((card) => (
                        <article className="landing-stat-card" key={card.value}>
                            <strong>{card.value}</strong>
                            <span>{card.label}</span>
                        </article>
                    ))}
                </section>

                <section className="landing-features" id="features">
                    <div className="landing-section-heading landing-section-heading--wide">
                        <span className="landing-page__eyebrow">Возможности</span>
                        <h2>Всё важное для первого workflow — на одной странице</h2>
                        <p>
                            Landing ведёт пользователя не к списку функций, а к понятному действию:
                            открыть demo, создать notebook и проверить выполнение процесса.
                        </p>
                    </div>

                    <div className="landing-features__grid">
                        {featureCards.map((feature) => (
                            <article className="landing-feature-card" key={feature.title}>
                                <span className="landing-feature-card__icon" aria-hidden="true">
                                    {feature.icon}
                                </span>
                                <h3>{feature.title}</h3>
                                <p>{feature.text}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="landing-steps" id="how-it-works">
                    <div className="landing-section-heading">
                        <span className="landing-page__eyebrow">Как работает</span>
                        <h2>От идеи до запуска — без лишних экранов</h2>
                    </div>

                    <div className="landing-steps__grid">
                        {workflowSteps.map((item) => (
                            <article className="landing-step-card" key={item.step}>
                                <span>{item.step}</span>
                                <h3>{item.title}</h3>
                                <p>{item.text}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <LandingAiModels />

                <section className="landing-run">
                    <div className="landing-run__content">
                        <span className="landing-page__eyebrow">Execution</span>
                        <h2>Запуск должен быть понятным, а не “чёрным ящиком”</h2>
                        <p>
                            FlowAct показывает состояние блоков, сохраняет логи и даёт быстрые
                            действия для проверки схемы. Пользователь видит, что именно произошло
                            с workflow после запуска.
                        </p>

                        <div className="landing-shortcuts" aria-label="Горячие клавиши редактора">
                            {shortcutCards.map((shortcut) => (
                                <div className="landing-shortcut" key={shortcut.keys}>
                                    <kbd>{shortcut.keys}</kbd>
                                    <span>{shortcut.action}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="landing-run__panel" aria-hidden="true">
                        <div className="landing-run__panel-header">
                            <span>Выполнение</span>
                            <strong>Успешно</strong>
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
                        <span className="landing-page__eyebrow">Сценарии</span>
                        <h2>Для каких задач подходит FlowAct</h2>
                        <p>
                            Сначала можно использовать FlowAct как визуальный редактор и систему
                            запуска процессов. По мере развития проекта сюда добавятся полноценные
                            пользовательские аккаунты, расписания и AI-рекомендации.
                        </p>
                    </div>

                    <div className="landing-tasks__grid">
                        {taskCards.map((task) => (
                            <article className="landing-task-card" key={task.title}>
                                <span>✓</span>
                                <div>
                                    <h3>{task.title}</h3>
                                    <p>{task.text}</p>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="landing-cta">
                    <span className="landing-page__eyebrow">Demo mode</span>
                    <h2>Откройте редактор и соберите первый workflow</h2>
                    <p>
                        Пока авторизация находится в режиме заглушки, можно сразу перейти к `/home`,
                        создать notebook и проверить базовый сценарий сохранения, запуска и логов.
                    </p>

                    <div className="landing-cta__actions">
                        <Link className="landing-page__primary-button landing-page__primary-button--large" to="/home">
                            Перейти к notebook
                        </Link>

                        <button
                            className="landing-page__secondary-button"
                            type="button"
                            onClick={() => openAuthModal('registration')}
                        >
                            Открыть форму
                        </button>
                    </div>
                </section>

                <footer className="landing-footer">
                    <span>FlowAct 2026</span>
                    <div className="landing-footer__links">
                        <a href="#features">Возможности</a>
                        <a href="#how-it-works">Как работает</a>
                        <Link to="/home">Notebook</Link>
                    </div>
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

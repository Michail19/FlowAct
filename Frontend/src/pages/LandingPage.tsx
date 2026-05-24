import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AuthModal, type AuthMode } from '../components/auth/AuthModal';
import { consumeAuthSessionMessage } from '../auth/authEvents';
import { useAuth } from '../auth/useAuth';
import { createDemoNotebookLocally } from '../services/notebookStorage';

import './LandingPage.css';
import './LandingPageTuning.css';
import './LandingAuthUx.css';
import './LandingMobileUx.css';

type AuthModalState = {
    mode: AuthMode;
} | null;

const heroHighlights = [
    'Визуальный редактор без лишней настройки',
    'Запуск workflow и понятные логи выполнения',
    'AI-подсказки и автодополнение сценариев',
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
        value: 'AI',
        label: 'подсказки помогают быстрее дополнять рабочий процесс',
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
        title: 'AI-помощник',
        text: 'Добавляйте AI-блоки, получайте подсказки и быстрее собирайте сценарии обработки данных.',
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
        text: 'Создавайте сценарии, где модель анализирует текст, формирует вывод и передаёт его дальше.',
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

function useLandingScrollReveal() {
    useEffect(() => {
        const pageElement = document.querySelector('.landing-page');
        const bodyElement = document.body;
        const revealElements = Array.from(
            document.querySelectorAll<HTMLElement>('[data-reveal]'),
        );

        bodyElement.classList.add('landing-page-body');
        pageElement?.classList.add('landing-page--animated');

        if (!('IntersectionObserver' in window)) {
            revealElements.forEach((element) => {
                element.classList.add('landing-reveal--visible');
            });
            return () => {
                bodyElement.classList.remove('landing-page-body');
                pageElement?.classList.remove('landing-page--animated');
            };
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) {
                        return;
                    }

                    entry.target.classList.add('landing-reveal--visible');
                    observer.unobserve(entry.target);
                });
            },
            {
                rootMargin: '0px 0px -12% 0px',
                threshold: 0.16,
            },
        );

        revealElements.forEach((element) => observer.observe(element));

        return () => {
            observer.disconnect();
            bodyElement.classList.remove('landing-page-body');
            pageElement?.classList.remove('landing-page--animated');
        };
    }, []);
}

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
                    <span title="Условие" />
                    <span title="AI" />
                    <span title="HTTP" />
                    <span title="Лог" />
                    <span title="Конец" />
                </aside>

                <div className="landing-editor-preview__canvas">
                    <div className="landing-editor-preview__node landing-editor-preview__node--start">
                        Старт
                    </div>
                    <div className="landing-editor-preview__node landing-editor-preview__node--condition">
                        IF
                    </div>
                    <div className="landing-editor-preview__node landing-editor-preview__node--ai">
                        AI-анализ
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
                        {/* Старт -> IF */}
                        <path d="M95 92 C112 92 124 92 150 92" />

                        {/* IF -> AI, ветка Да */}
                        <path d="M190 92 C226 92 238 42 290 42" />

                        {/* IF -> Лог, ветка Нет */}
                        <path d="M190 92 C226 92 238 142 292 142" />

                        {/* AI -> Конец */}
                        <path d="M365 42 C420 42 424 104 482 92" />

                        {/* Лог -> Конец */}
                        <path d="M365 142 C420 142 424 80 482 92" />
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

type LandingModelIconName = 'openai' | 'qwen3' | 'openrouter' | 'gemma';

function LandingModelIcon({ name }: { name: LandingModelIconName }) {
    if (name === 'openai') {
        return (
            <svg
                className="landing-ai__model-icon"
                viewBox="0 0 96 96"
                role="img"
                aria-label="OpenAI"
            >
                <g
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M48 15c9 0 16 5 19 13 8 1 14 8 14 17 0 6-3 12-8 15 1 8-3 16-11 20-6 3-13 3-19-1-7 5-17 4-23-2-6-6-8-15-4-23-5-6-6-15-2-22 4-7 12-11 20-10 3-5 8-7 14-7Z" />
                    <path d="M35 23 60 37" />
                    <path d="M68 31 68 59" />
                    <path d="M73 60 48 74" />
                    <path d="M40 72 16 58" />
                    <path d="M15 47 39 33" />
                    <path d="M30 55 56 40" />
                    <path d="M41 34 41 64" />
                    <path d="M56 64 30 49" />
                </g>
            </svg>
        );
    }

    if (name === 'qwen3') {
        return (
            <svg
                className="landing-ai__model-icon landing-ai__model-icon--qwen3"
                viewBox="0 0 96 96"
                role="img"
                aria-label="Qwen3"
            >
                <circle
                    cx="48"
                    cy="48"
                    r="28"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="7"
                />

                <path
                    d="M62 62 75 75"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="7"
                    strokeLinecap="round"
                />

                <path
                    d="M35 43c3-7 9-11 17-10 8 1 13 7 13 15 0 6-3 11-8 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                />

                <text
                    x="48"
                    y="57"
                    textAnchor="middle"
                    className="landing-ai__model-icon-text"
                >
                    3
                </text>
            </svg>
        );
    }

    if (name === 'openrouter') {
        return (
            <svg
                className="landing-ai__model-icon landing-ai__model-icon--openrouter"
                viewBox="0 0 96 96"
                role="img"
                aria-label="OpenRouter"
            >
                <g
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M18 32h34c9 0 15 6 15 15v3" />
                    <path d="M57 20 70 32 57 44" />

                    <path d="M78 64H44c-9 0-15-6-15-15v-3" />
                    <path d="M39 76 26 64 39 52" />

                    <path d="M30 48h36" opacity="0.42" />
                </g>
            </svg>
        );
    }

    return (
        <svg
            className="landing-ai__model-icon landing-ai__model-icon--gemma"
            viewBox="0 0 96 96"
            role="img"
            aria-label="Gemma"
        >
            <path
                d="M48 12 57 39 84 48 57 57 48 84 39 57 12 48 39 39Z"
                fill="currentColor"
            />
            <path
                d="M67 13 71 25 83 29 71 33 67 45 63 33 51 29 63 25Z"
                fill="currentColor"
                opacity="0.72"
            />
        </svg>
    );
}

function LandingAiModels() {
    return (
        <section className="landing-ai" id="ai" data-reveal="section">
            <div className="landing-ai__visual" aria-label="Поддерживаемые AI-модели">
                <span className="landing-ai__orb landing-ai__orb--openai">
                    <LandingModelIcon name="openai" />
                    <span className="landing-ai__orb-label">OpenAI</span>
                </span>

                <span className="landing-ai__orb landing-ai__orb--gemma">
                    <LandingModelIcon name="gemma" />
                    <span className="landing-ai__orb-label">Gemma</span>
                </span>

                <span className="landing-ai__orb landing-ai__orb--qwen3">
                    <LandingModelIcon name="qwen3" />
                    <span className="landing-ai__orb-label">Qwen3</span>
                </span>

                <span className="landing-ai__orb landing-ai__orb--openrouter">
                    <LandingModelIcon name="openrouter" />
                    <span className="landing-ai__orb-label">OpenRouter</span>
                </span>
            </div>

            <div className="landing-ai__content">
                <span className="landing-page__eyebrow">AI-интеграции</span>
                <h2>AI становится частью процесса, а не отдельным окном</h2>
                <p>
                    FlowAct связывает AI-блоки с остальной схемой: модель получает данные из
                    предыдущего блока, анализирует их и передаёт результат дальше по workflow.
                    Это удобно для классификации, генерации текста, проверки условий и подсказок.
                </p>

                <div className="landing-ai__chips" aria-label="Поддерживаемые модели">
                    <span>OpenAI</span>
                    <span>Qwen3</span>
                    <span>OpenRouter</span>
                    <span>Gemma</span>
                </div>
            </div>
        </section>
    );
}

function LandingPage() {
    const navigate = useNavigate();
    const [authModal, setAuthModal] = useState<AuthModalState>(null);
    const [sessionMessage, setSessionMessage] = useState<string | null>(() =>
        consumeAuthSessionMessage(),
    );
    const [isDemoStarting, setIsDemoStarting] = useState(false);
    const { isAuthenticated, startDemo } = useAuth();

    useLandingScrollReveal();

    const openAuthModal = (mode: AuthMode) => {
        if (isAuthenticated) {
            return;
        }

        setSessionMessage(null);
        setAuthModal({ mode });
    };

    const closeAuthModal = () => {
        setAuthModal(null);
    };

    const switchAuthMode = (mode: AuthMode) => {
        if (isAuthenticated) {
            return;
        }

        setAuthModal({ mode });
    };

    const handleStartDemo = async () => {
        if (isAuthenticated || isDemoStarting) {
            return;
        }

        setSessionMessage(null);
        setIsDemoStarting(true);

        try {
            await startDemo();
            const demoNotebook = createDemoNotebookLocally();
            navigate(`/notebook/${demoNotebook.id}`, {
                replace: true,
                state: { isDemo: true },
            });
        } catch {
            setSessionMessage('Не удалось запустить demo-режим. Попробуйте ещё раз.');
        } finally {
            setIsDemoStarting(false);
        }
    };

    const mainCta = isAuthenticated ? (
        <Link className="landing-page__primary-button" to="/home">
            Открыть редактор
        </Link>
    ) : (
        <button
            className="landing-page__primary-button"
            type="button"
            onClick={handleStartDemo}
            disabled={isDemoStarting}
        >
            {isDemoStarting ? 'Запуск...' : 'Попробовать'}
        </button>
    );

    return (
        <main className="landing-page">
            <section className="landing-page__shell">
                <header className="landing-page__topbar" data-reveal="down">
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
                        {isAuthenticated ? (
                            <Link
                                className="landing-page__login-button landing-page__workspace-button"
                                to="/home"
                                aria-label="Перейти в workspace"
                            >
                                <span className="landing-page__workspace-button-icon" aria-hidden="true">
                                    ↗
                                </span>
                                <span>Workspace</span>
                            </Link>
                        ) : (
                            <>
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
                                    Зарегистрироваться
                                </button>
                            </>
                        )}
                    </div>
                </header>

                {sessionMessage && !isAuthenticated && (
                    <div className="landing-page__session-message" role="status">
                        <span>{sessionMessage}</span>
                        <button type="button" onClick={() => setSessionMessage(null)}>
                            ×
                        </button>
                    </div>
                )}

                <section className="landing-hero" id="about">
                    <div className="landing-hero__content" data-reveal="up">
                        <span className="landing-page__eyebrow">Workflow automation</span>

                        <h1>
                            Собирайте рабочие процессы как схему на доске
                        </h1>

                        <p>
                            FlowAct помогает визуально собрать цепочку действий, запустить её,
                            увидеть результат каждого блока и добавить AI-логику без ручного
                            связывания сервисов.
                        </p>

                        <div className="landing-hero__buttons">
                            {mainCta}

                            {!isAuthenticated && (
                                <button
                                    className="landing-page__secondary-button"
                                    type="button"
                                    onClick={() => openAuthModal('registration')}
                                >
                                    Создать аккаунт
                                </button>
                            )}

                            {isAuthenticated && (
                                <a className="landing-page__secondary-button" href="#how-it-works">
                                    Как это работает
                                </a>
                            )}
                        </div>

                        <ul className="landing-hero__highlights" aria-label="Ключевые преимущества">
                            {heroHighlights.map((highlight) => (
                                <li key={highlight}>{highlight}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="landing-hero__preview" id="preview" data-reveal="scale">
                        <LandingEditorPreview />
                    </div>
                </section>

                <section className="landing-stats" aria-label="Кратко о FlowAct" data-reveal="up">
                    {statsCards.map((card) => (
                        <article className="landing-stat-card" key={card.value}>
                            <strong>{card.value}</strong>
                            <span>{card.label}</span>
                        </article>
                    ))}
                </section>

                <section className="landing-features" id="features" data-reveal="up">
                    <div className="landing-section-heading landing-section-heading--wide">
                        <span className="landing-page__eyebrow">Возможности</span>
                        <h2>Всё важное для первого workflow — на одной странице</h2>
                        <p>
                            FlowAct ведёт пользователя к понятному действию: открыть редактор,
                            создать notebook, собрать схему и проверить выполнение процесса.
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

                <section className="landing-steps" id="how-it-works" data-reveal="up">
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

                <section className="landing-run" data-reveal="up">
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

                <section className="landing-tasks" id="tasks" data-reveal="up">
                    <div className="landing-tasks__header">
                        <span className="landing-page__eyebrow">Сценарии</span>
                        <h2>Где FlowAct особенно полезен</h2>
                        <p>
                            Начните с простого процесса и постепенно усложняйте workflow:
                            добавляйте условия, внешние сервисы, AI-блоки и логи.
                        </p>
                    </div>

                    <div className="landing-tasks__grid">
                        {taskCards.map((task) => (
                            <article className="landing-task-card" key={task.title}>
                                <h3>{task.title}</h3>
                                <p>{task.text}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="landing-cta" data-reveal="up">
                    <span className="landing-page__eyebrow">Начать</span>
                    <h2>Соберите первый workflow прямо сейчас</h2>
                    <p>
                        Откройте редактор, создайте notebook и проверьте схему на примере
                        простого процесса.
                    </p>

                    <div className="landing-cta__actions">
                        {isAuthenticated ? (
                            <Link className="landing-page__primary-button landing-page__primary-button--large" to="/home">
                                Перейти в workspace
                            </Link>
                        ) : (
                            <>
                                <button
                                    className="landing-page__primary-button landing-page__primary-button--large"
                                    type="button"
                                    onClick={handleStartDemo}
                                    disabled={isDemoStarting}
                                >
                                    {isDemoStarting ? 'Запуск...' : 'Попробовать demo'}
                                </button>

                                <button
                                    className="landing-page__secondary-button"
                                    type="button"
                                    onClick={() => openAuthModal('login')}
                                >
                                    Уже есть аккаунт
                                </button>
                            </>
                        )}
                    </div>
                </section>

                <footer className="landing-footer">
                    <span>FlowAct</span>
                    <a href="#about">Наверх</a>
                </footer>
            </section>

            {authModal && !isAuthenticated && (
                <AuthModal
                    initialMode={authModal.mode}
                    onClose={closeAuthModal}
                    onSwitchMode={switchAuthMode}
                />
            )}
        </main>
    );
}

export default LandingPage;

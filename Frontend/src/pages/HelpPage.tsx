import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
    BLOCK_SETTINGS_HELP,
    TEMPLATE_VARIABLE_HINTS,
    type BlockSettingsHelp,
} from '../components/notebook/blockSettingsHelp';
import type { NotebookBlockType } from '../components/notebook/notebookTypes';

import './HelpPage.css';

const blockTitles: Record<NotebookBlockType, string> = {
    start: 'Start',
    end: 'End',
    ai: 'AI-функция',
    condition: 'IF / условие',
    action: 'Action / преобразование',
    database: 'Database',
    email: 'Email',
    log: 'Log',
    http: 'HTTP-запрос',
    loop: 'Loop / цикл',
    merge: 'Merge / объединение',
};

const blockOrder: NotebookBlockType[] = [
    'start',
    'http',
    'ai',
    'condition',
    'action',
    'log',
    'database',
    'email',
    'loop',
    'merge',
    'end',
];

const quickStartSteps = [
    {
        title: 'Создайте notebook',
        text: 'Notebook хранит схему, блоки, связи, состояние сохранения и данные workflow на backend.',
    },
    {
        title: 'Добавьте Start и End',
        text: 'Start задаёт точку входа, а End фиксирует финальный результат выполнения процесса.',
    },
    {
        title: 'Соберите цепочку блоков',
        text: 'Добавляйте HTTP, AI, IF, Log и другие блоки, затем соединяйте их стрелками слева направо.',
    },
    {
        title: 'Проверьте схему',
        text: 'Перед запуском проверьте, что блоки достижимы от Start, нет разрывов и есть финальный End.',
    },
    {
        title: 'Запустите workflow',
        text: 'После запуска откройте панель логов и результатов, чтобы увидеть статусы блоков и output.',
    },
];

const systemFeatures = [
    {
        title: 'Сохранение и автосохранение',
        text: 'Notebook сохраняется на backend, а при недоступности сервера остаётся локальная копия с последующей синхронизацией.',
    },
    {
        title: 'Валидация схемы',
        text: 'Проверка помогает найти блоки без связей, отсутствующий Start/End, незавершённые ветки IF и другие ошибки структуры.',
    },
    {
        title: 'Запуск workflow',
        text: 'ExecutionService создаёт execution, WorkerService выполняет блоки по связям, а результат сохраняется в логах выполнения.',
    },
    {
        title: 'Логи и результаты',
        text: 'После запуска можно посмотреть output блоков, технические статусы и ошибки, если выполнение остановилось.',
    },
    {
        title: 'AI-подсказки',
        text: 'Подсказки помогают дополнить неполную схему следующим логичным блоком, но пользователь сам решает, добавлять его или нет.',
    },
    {
        title: 'Импорт и экспорт',
        text: 'Notebook можно экспортировать в JSON, импортировать обратно и сохранять визуальное превью схемы в PNG.',
    },
];

const shortcuts = [
    ['Ctrl + S / Cmd + S', 'Сохранить notebook'],
    ['Ctrl + Z / Cmd + Z', 'Отменить последнее действие на canvas'],
    ['Ctrl + Shift + Z / Cmd + Shift + Z', 'Повторить отменённое действие'],
    ['Ctrl + Y / Cmd + Y', 'Альтернативный redo'],
    ['Ctrl + C / Cmd + C', 'Скопировать выбранные блоки'],
    ['Ctrl + X / Cmd + X', 'Вырезать выбранные блоки'],
    ['Ctrl + V / Cmd + V', 'Вставить скопированные блоки'],
    ['Ctrl + Enter / Cmd + Enter', 'Запустить workflow'],
    ['Ctrl + Shift + A / Cmd + Shift + A', 'Автосборка схемы'],
    ['Ctrl + Shift + V / Cmd + Shift + V', 'Проверить схему'],
    ['Ctrl + Shift + L / Cmd + Shift + L', 'Открыть логи и результат'],
];

const conditionExamples = [
    ['value.status', 'Статус результата предыдущего блока'],
    ['value.ok', 'Флаг успешности HTTP-запроса'],
    ['value.body.type', 'Поле type внутри HTTP body'],
    ['input.type', 'Поле type из исходного input запуска workflow'],
    ['variables.mode', 'Runtime-переменная mode'],
];

const validationChecklist = [
    'В схеме есть один понятный Start и хотя бы один End.',
    'Все рабочие блоки достижимы от Start.',
    'У каждого промежуточного блока есть входящая и исходящая связь, если тип блока не предполагает исключение.',
    'IF-блок имеет отдельные ветки Да и Нет через handles yes/no.',
    'HTTP/AI/Email/Database блоки заполнены минимально необходимыми настройками.',
    'Нет случайных изолированных блоков, которые не участвуют в запуске.',
];

const helpSections = [
    { id: 'quick-start', label: 'Быстрый старт' },
    { id: 'system-features', label: 'Возможности системы' },
    { id: 'variables', label: 'Переменные' },
    { id: 'condition-syntax', label: 'Условия IF' },
    { id: 'blocks', label: 'Блоки' },
    { id: 'validation', label: 'Валидация' },
    { id: 'shortcuts', label: 'Горячие клавиши' },
    { id: 'export-import', label: 'Экспорт и импорт' },
] as const;

function useActiveHelpSection(sectionIds: string[]) {
    const [activeSectionId, setActiveSectionId] = useState(
        sectionIds[0] ?? '',
    );

    useEffect(() => {
        let frameId = 0;

        const updateActiveSection = () => {
            frameId = 0;

            const activationOffset = 180;
            let nextActiveSectionId = sectionIds[0] ?? '';

            for (const sectionId of sectionIds) {
                const sectionElement = document.getElementById(sectionId);

                if (!sectionElement) {
                    continue;
                }

                const sectionTop = sectionElement.getBoundingClientRect().top;

                if (sectionTop <= activationOffset) {
                    nextActiveSectionId = sectionId;
                }
            }

            setActiveSectionId(nextActiveSectionId);
        };

        const requestUpdate = () => {
            if (frameId !== 0) {
                return;
            }

            frameId = window.requestAnimationFrame(updateActiveSection);
        };

        updateActiveSection();

        window.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', requestUpdate);

        return () => {
            if (frameId !== 0) {
                window.cancelAnimationFrame(frameId);
            }

            window.removeEventListener('scroll', requestUpdate);
            window.removeEventListener('resize', requestUpdate);
        };
    }, [sectionIds]);

    return activeSectionId;
}

// function createAnchor(value: string) {
//     return value.replace(/[^a-zA-Zа-яА-Я0-9_-]+/g, '-').toLowerCase();
// }

function renderTemplate(template: string) {
    return template.includes('\n') ? template : template.trim();
}

function BlockHelpCard({
    type,
    help,
}: {
    type: NotebookBlockType;
    help: BlockSettingsHelp;
}) {
    const anchor = `block-${type}`;

    return (
        <article className="help-page__block-card" id={anchor}>
            <div className="help-page__block-header">
                <div>
                    <span className="help-page__backend-badge">{help.backendType}</span>
                    <h3>{blockTitles[type]}</h3>
                </div>
                <a className="help-page__anchor" href={`#${anchor}`}>#</a>
            </div>

            <p className="help-page__block-summary">{help.summary}</p>

            <div className="help-page__io-grid">
                <div>
                    <strong>Вход</strong>
                    <p>{help.input}</p>
                </div>
                <div>
                    <strong>Выход</strong>
                    <p>{help.output}</p>
                </div>
            </div>

            <div className="help-page__block-columns">
                <section>
                    <h4>Переменные</h4>
                    <ul className="help-page__list">
                        {help.variables.map((variable) => (
                            <li key={variable}>{variable}</li>
                        ))}
                    </ul>
                </section>

                <section>
                    <h4>Готовые шаблоны</h4>
                    <div className="help-page__templates">
                        {help.templates.map((template) => (
                            <pre key={template}><code>{renderTemplate(template)}</code></pre>
                        ))}
                    </div>
                </section>
            </div>

            {help.notes && help.notes.length > 0 && (
                <section className="help-page__notes">
                    <h4>Важно</h4>
                    <ul className="help-page__list">
                        {help.notes.map((note) => (
                            <li key={note}>{note}</li>
                        ))}
                    </ul>
                </section>
            )}
        </article>
    );
}

function HelpPage() {
    const orderedBlocks = blockOrder.map((type) => ({
        type,
        help: BLOCK_SETTINGS_HELP[type],
    }));

    const sectionIds = useMemo(
        () => helpSections.map((section) => section.id),
        [],
    );

    const activeSectionId = useActiveHelpSection(sectionIds);

    const handleSectionLinkClick = useCallback(
        (event: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
            event.preventDefault();

            document.getElementById(sectionId)?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });

            window.history.replaceState(null, '', `#${sectionId}`);
        },
        [],
    );

    return (
        <main className="help-page">
            <header className="help-page__topbar">
                <Link className="help-page__brand" to="/landing">
                    <span>F</span>
                    FlowAct
                </Link>

                <nav className="help-page__top-actions" aria-label="Навигация справки">
                    <Link to="/landing">Главная</Link>
                    <Link to="/home">Домой</Link>
                </nav>
            </header>

            <section className="help-page__hero">
                <span className="help-page__eyebrow">Справка пользователя</span>
                <h1>Как работать с FlowAct</h1>
                <p>
                    Эта страница описывает работу редактора, запуск workflow, проверку схемы,
                    горячие клавиши, переменные шаблонов и назначение каждого блока. Она не
                    меняет поведение notebook — это отдельная пользовательская документация.
                </p>
            </section>

            <div className="help-page__layout">
                <aside className="help-page__sidebar" aria-label="Разделы справки">
                    {helpSections.map((section) => (
                        <a
                            className={
                                activeSectionId === section.id
                                    ? 'help-page__sidebar-link help-page__sidebar-link--active'
                                    : 'help-page__sidebar-link'
                            }
                            href={`#${section.id}`}
                            key={section.id}
                            aria-current={activeSectionId === section.id ? 'true' : undefined}
                            onClick={(event) => handleSectionLinkClick(event, section.id)}
                        >
                            {section.label}
                        </a>
                    ))}
                </aside>

                <div className="help-page__content">
                    <section className="help-page__section" id="quick-start">
                        <div className="help-page__section-heading">
                            <span>01</span>
                            <h2>Быстрый старт</h2>
                        </div>

                        <div className="help-page__steps">
                            {quickStartSteps.map((step, index) => (
                                <article className="help-page__step" key={step.title}>
                                    <strong>{String(index + 1).padStart(2, '0')}</strong>
                                    <h3>{step.title}</h3>
                                    <p>{step.text}</p>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section className="help-page__section" id="system-features">
                        <div className="help-page__section-heading">
                            <span>02</span>
                            <h2>Возможности системы</h2>
                        </div>

                        <div className="help-page__feature-grid">
                            {systemFeatures.map((feature) => (
                                <article className="help-page__feature" key={feature.title}>
                                    <h3>{feature.title}</h3>
                                    <p>{feature.text}</p>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section className="help-page__section" id="variables">
                        <div className="help-page__section-heading">
                            <span>03</span>
                            <h2>Переменные в шаблонах</h2>
                        </div>

                        <p className="help-page__lead">
                            В текстовых полях HTTP, AI, Log, Email, Action и Database можно использовать
                            шаблоны вида <code>{'{{value.text}}'}</code>. Перед выполнением backend
                            подставляет данные текущего execution.
                        </p>

                        <div className="help-page__chips">
                            {TEMPLATE_VARIABLE_HINTS.map((variable) => (
                                <code key={variable}>{variable}</code>
                            ))}
                        </div>

                        <div className="help-page__callout">
                            <strong>Главное правило</strong>
                            <p>
                                В обычных шаблонах переменные пишутся в фигурных скобках:
                                <code>{'{{value.status}}'}</code>. В IF-блоке путь пишется без скобок:
                                <code>value.status</code>.
                            </p>
                        </div>
                    </section>

                    <section className="help-page__section" id="condition-syntax">
                        <div className="help-page__section-heading">
                            <span>04</span>
                            <h2>Синтаксис условий IF</h2>
                        </div>

                        <p className="help-page__lead">
                            IF проверяет путь к значению, оператор и ожидаемое значение. Результат
                            выполнения направляет workflow в ветку <strong>Да</strong> или <strong>Нет</strong>.
                        </p>

                        <div className="help-page__table-wrap">
                            <table className="help-page__table">
                                <thead>
                                    <tr>
                                        <th>Путь</th>
                                        <th>Что означает</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {conditionExamples.map(([path, description]) => (
                                        <tr key={path}>
                                            <td><code>{path}</code></td>
                                            <td>{description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="help-page__section" id="blocks">
                        <div className="help-page__section-heading">
                            <span>05</span>
                            <h2>Блоки workflow</h2>
                        </div>

                        <nav className="help-page__block-nav" aria-label="Навигация по блокам">
                            {orderedBlocks.map(({ type }) => (
                                <a key={type} href={`#block-${type}`}>{blockTitles[type]}</a>
                            ))}
                        </nav>

                        <div className="help-page__blocks">
                            {orderedBlocks.map(({ type, help }) => (
                                <BlockHelpCard key={type} type={type} help={help} />
                            ))}
                        </div>
                    </section>

                    <section className="help-page__section" id="validation">
                        <div className="help-page__section-heading">
                            <span>06</span>
                            <h2>Проверка схемы перед запуском</h2>
                        </div>

                        <p className="help-page__lead">
                            Валидация нужна, чтобы execution не запускался по неполной или неоднозначной
                            схеме. Используйте её после изменения связей и перед финальным запуском.
                        </p>

                        <ul className="help-page__checklist">
                            {validationChecklist.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </section>

                    <section className="help-page__section" id="shortcuts">
                        <div className="help-page__section-heading">
                            <span>07</span>
                            <h2>Горячие клавиши</h2>
                        </div>

                        <div className="help-page__table-wrap">
                            <table className="help-page__table">
                                <thead>
                                    <tr>
                                        <th>Комбинация</th>
                                        <th>Действие</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {shortcuts.map(([keys, action]) => (
                                        <tr key={keys}>
                                            <td><kbd>{keys}</kbd></td>
                                            <td>{action}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="help-page__section" id="export-import">
                        <div className="help-page__section-heading">
                            <span>08</span>
                            <h2>Экспорт, импорт и перенос схем</h2>
                        </div>

                        <div className="help-page__feature-grid help-page__feature-grid--three">
                            <article className="help-page__feature">
                                <h3>JSON export</h3>
                                <p>
                                    Сохраняет структуру notebook: блоки, связи, настройки и локальные
                                    данные, чтобы схему можно было перенести или восстановить.
                                </p>
                            </article>
                            <article className="help-page__feature">
                                <h3>JSON import</h3>
                                <p>
                                    Загружает notebook из JSON на странице workspace. После импорта
                                    схему можно открыть, проверить и сохранить на backend.
                                </p>
                            </article>
                            <article className="help-page__feature">
                                <h3>PNG export</h3>
                                <p>
                                    Создаёт изображение визуальной схемы для отчёта, демонстрации или
                                    быстрого просмотра без открытия редактора.
                                </p>
                            </article>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}

export default HelpPage;

import NotebookIconButton from './NotebookIconButton';

import './NotebookToolbar.css';

const blockButtons = [
    { icon: '○', label: 'Начальный блок' },
    { icon: '●', label: 'Конечный блок' },
    { icon: '⊘', label: 'Условие' },
    { icon: '▰', label: 'Действие' },
    { icon: '◆', label: 'Преобразование данных' },
    { icon: '🤖', label: 'AI-блок' },
    { icon: '▱', label: 'Интеграция' },
    { icon: '▣', label: 'Логирование' },
];

function NotebookToolbar() {
    return (
        <aside className="notebook-toolbar" aria-label="Панель блоков">
            <div className="notebook-toolbar__blocks">
                {blockButtons.map((block) => (
                    <NotebookIconButton key={block.label} icon={block.icon} label={block.label} />
                ))}
            </div>

            <div className="notebook-toolbar__actions">
                <NotebookIconButton icon="✦" label="AI-помощник" active variant="circle" />
                <NotebookIconButton icon="▶" label="Запустить рабочий процесс" active variant="circle" />
            </div>
        </aside>
    );
}

export default NotebookToolbar;

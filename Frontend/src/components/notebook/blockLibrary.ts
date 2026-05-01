import type { NotebookBlockType } from './notebookTypes';

export type NotebookBlockDefinition = {
    blockType: NotebookBlockType;
    nodeType: 'customBlock' | 'aiBlock';
    title: string;
    subtitle: string;
    description: string;
    icon: string;
    toolbarLabel: string;
    toolbarIcon: string;
};

export const NOTEBOOK_BLOCK_LIBRARY: NotebookBlockDefinition[] = [
    {
        blockType: 'start',
        nodeType: 'customBlock',
        title: 'Старт',
        subtitle: 'Запуск рабочего процесса',
        description: 'Начальная точка выполнения рабочего процесса.',
        icon: '▶',
        toolbarLabel: 'Начальный блок',
        toolbarIcon: '○',
    },
    {
        blockType: 'end',
        nodeType: 'customBlock',
        title: 'Конец',
        subtitle: 'Завершение процесса',
        description: 'Финальная точка выполнения рабочего процесса.',
        icon: '■',
        toolbarLabel: 'Конечный блок',
        toolbarIcon: '●',
    },
    {
        blockType: 'ai',
        nodeType: 'aiBlock',
        title: 'AI-функция',
        subtitle: 'Обработка через нейросеть',
        description: 'Блок для генерации, анализа или преобразования текста через выбранные модели.',
        icon: '🤖',
        toolbarLabel: 'AI-блок',
        toolbarIcon: '🤖',
    },
    {
        blockType: 'condition',
        nodeType: 'customBlock',
        title: 'Условие',
        subtitle: 'Проверка результата',
        description: 'Ветвление рабочего процесса по заданному условию.',
        icon: '◇',
        toolbarLabel: 'Условие',
        toolbarIcon: '⊘',
    },
    {
        blockType: 'action',
        nodeType: 'customBlock',
        title: 'Действие',
        subtitle: 'Выполнение операции',
        description: 'Универсальный блок действия внутри рабочего процесса.',
        icon: '▰',
        toolbarLabel: 'Действие',
        toolbarIcon: '▰',
    },
    {
        blockType: 'database',
        nodeType: 'customBlock',
        title: 'База данных',
        subtitle: 'Работа с данными',
        description: 'Чтение, запись или обновление данных во внешнем хранилище.',
        icon: 'DB',
        toolbarLabel: 'База данных',
        toolbarIcon: '◆',
    },
    {
        blockType: 'email',
        nodeType: 'customBlock',
        title: 'Email',
        subtitle: 'Отправка сообщения',
        description: 'Отправка уведомления или результата пользователю.',
        icon: '✉',
        toolbarLabel: 'Email',
        toolbarIcon: '▱',
    },
    {
        blockType: 'log',
        nodeType: 'customBlock',
        title: 'Логирование',
        subtitle: 'История выполнения',
        description: 'Сохранение информации о ходе выполнения рабочего процесса.',
        icon: 'LOG',
        toolbarLabel: 'Логирование',
        toolbarIcon: '▣',
    },
    {
        blockType: 'http',
        nodeType: 'customBlock',
        title: 'HTTP-запрос',
        subtitle: 'Вызов внешнего API',
        description: 'Отправляет HTTP-запрос во внешний сервис и передаёт ответ дальше по рабочему процессу.',
        icon: 'HTTP',
        toolbarLabel: 'HTTP-запрос',
        toolbarIcon: '↗',
    },
    {
        blockType: 'loop',
        nodeType: 'customBlock',
        title: 'Цикл',
        subtitle: 'Итерация по коллекции',
        description: 'Обрабатывает набор элементов внутри одного блока и возвращает результат итерации.',
        icon: '↻',
        toolbarLabel: 'Цикл',
        toolbarIcon: '↻',
    },
    {
        blockType: 'merge',
        nodeType: 'customBlock',
        title: 'Объединение',
        subtitle: 'Слияние веток',
        description: 'Объединяет несколько входящих веток рабочего процесса в один общий поток.',
        icon: 'MERGE',
        toolbarLabel: 'Объединение',
        toolbarIcon: '⋈',
    },
];

export function getBlockDefinition(blockType: NotebookBlockType): NotebookBlockDefinition {
    const definition = NOTEBOOK_BLOCK_LIBRARY.find((block) => block.blockType === blockType);

    if (!definition) {
        throw new Error(`Unknown block type: ${blockType}`);
    }

    return definition;
}

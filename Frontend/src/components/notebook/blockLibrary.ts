import type { NotebookBlockType } from './notebookTypes';
import type { NotebookSvgIconName } from './notebookSvgIconTypes';

export type NotebookBlockDefinition = {
    blockType: NotebookBlockType;
    nodeType: 'customBlock' | 'aiBlock';
    title: string;
    subtitle: string;
    description: string;
    icon: NotebookSvgIconName;
    toolbarLabel: string;
    toolbarIcon: NotebookSvgIconName;
};

export const NOTEBOOK_BLOCK_LIBRARY: NotebookBlockDefinition[] = [
    {
        blockType: 'start',
        nodeType: 'customBlock',
        title: 'Старт',
        subtitle: 'Запуск рабочего процесса',
        description: 'Начальная точка выполнения рабочего процесса.',
        icon: 'start',
        toolbarLabel: 'Начальный блок',
        toolbarIcon: 'start',
    },
    {
        blockType: 'end',
        nodeType: 'customBlock',
        title: 'Конец',
        subtitle: 'Завершение процесса',
        description: 'Финальная точка выполнения рабочего процесса.',
        icon: 'end',
        toolbarLabel: 'Конечный блок',
        toolbarIcon: 'end',
    },
    {
        blockType: 'ai',
        nodeType: 'aiBlock',
        title: 'AI-функция',
        subtitle: 'Обработка через нейросеть',
        description: 'Блок для генерации, анализа или преобразования текста через выбранные модели.',
        icon: 'ai',
        toolbarLabel: 'AI-блок',
        toolbarIcon: 'ai',
    },
    {
        blockType: 'condition',
        nodeType: 'customBlock',
        title: 'Условие',
        subtitle: 'Проверка результата',
        description: 'Ветвление рабочего процесса по заданному условию.',
        icon: 'condition',
        toolbarLabel: 'Условие',
        toolbarIcon: 'condition',
    },
    {
        blockType: 'action',
        nodeType: 'customBlock',
        title: 'Действие',
        subtitle: 'Выполнение операции',
        description: 'Универсальный блок действия внутри рабочего процесса.',
        icon: 'action',
        toolbarLabel: 'Действие',
        toolbarIcon: 'action',
    },
    {
        blockType: 'database',
        nodeType: 'customBlock',
        title: 'База данных',
        subtitle: 'Работа с данными',
        description: 'Чтение, запись или обновление данных во внешнем хранилище.',
        icon: 'database',
        toolbarLabel: 'База данных',
        toolbarIcon: 'database',
    },
    {
        blockType: 'email',
        nodeType: 'customBlock',
        title: 'Email',
        subtitle: 'Отправка сообщения',
        description: 'Отправка уведомления или результата пользователю.',
        icon: 'email',
        toolbarLabel: 'Email',
        toolbarIcon: 'email',
    },
    {
        blockType: 'log',
        nodeType: 'customBlock',
        title: 'Логирование',
        subtitle: 'История выполнения',
        description: 'Сохранение информации о ходе выполнения рабочего процесса.',
        icon: 'log',
        toolbarLabel: 'Логирование',
        toolbarIcon: 'log',
    },
    {
        blockType: 'http',
        nodeType: 'customBlock',
        title: 'HTTP-запрос',
        subtitle: 'Вызов внешнего API',
        description: 'Отправляет HTTP-запрос во внешний сервис и передаёт ответ дальше по рабочему процессу.',
        icon: 'http',
        toolbarLabel: 'HTTP-запрос',
        toolbarIcon: 'http',
    },
    {
        blockType: 'loop',
        nodeType: 'customBlock',
        title: 'Цикл',
        subtitle: 'Итерация по коллекции',
        description: 'Обрабатывает набор элементов внутри одного блока и возвращает результат итерации.',
        icon: 'loop',
        toolbarLabel: 'Цикл',
        toolbarIcon: 'loop',
    },
    {
        blockType: 'merge',
        nodeType: 'customBlock',
        title: 'Объединение',
        subtitle: 'Слияние веток',
        description: 'Объединяет несколько входящих веток рабочего процесса в один общий поток.',
        icon: 'merge',
        toolbarLabel: 'Объединение',
        toolbarIcon: 'merge',
    },
];

export function getBlockDefinition(blockType: NotebookBlockType): NotebookBlockDefinition {
    const definition = NOTEBOOK_BLOCK_LIBRARY.find((block) => block.blockType === blockType);

    if (!definition) {
        throw new Error(`Unknown block type: ${blockType}`);
    }

    return definition;
}

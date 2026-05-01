import type { Edge } from '@xyflow/react';

import { DEFAULT_AI_MODEL_ID } from './aiModels';
import type { AiBlockConfig, NotebookNode } from './notebookTypes';

export const defaultAiConfig: AiBlockConfig = {
    prompt: 'Проанализируй входящий текст пользователя и подготовь структурированный ответ.',
    models: [DEFAULT_AI_MODEL_ID],
};

export const retryAiConfig: AiBlockConfig = {
    prompt: 'Повтори обработку результата, исправь ошибки и подготовь новый вариант ответа.',
    models: [DEFAULT_AI_MODEL_ID],
};

export const initialNodes: NotebookNode[] = [
    {
        id: 'start',
        type: 'customBlock',
        position: { x: 80, y: 180 },
        data: {
            title: 'Старт',
            subtitle: 'Запуск рабочего процесса',
            description: 'Начальная точка выполнения рабочего процесса.',
            icon: '▶',
            blockType: 'start',
            status: 'success',
        },
    },
    {
        id: 'ai-main',
        type: 'aiBlock',
        position: { x: 390, y: 150 },
        data: {
            title: 'AI-функция',
            blockType: 'ai',
            status: 'idle',
            aiConfig: defaultAiConfig,
        },
    },
    {
        id: 'condition-check',
        type: 'customBlock',
        position: { x: 820, y: 180 },
        data: {
            title: 'Проверка результата',
            subtitle: 'Если ответ корректный',
            description: 'Проверяет, можно ли перейти к сохранению результата.',
            icon: '◇',
            blockType: 'condition',
            status: 'idle',
        },
    },
    {
        id: 'database-save',
        type: 'customBlock',
        position: { x: 1160, y: 70 },
        data: {
            title: 'Сохранить в БД',
            subtitle: 'Запись результата выполнения',
            description: 'Сохраняет результат выполнения в базу данных.',
            icon: 'DB',
            blockType: 'database',
            status: 'idle',
        },
    },
    {
        id: 'email-send',
        type: 'customBlock',
        position: { x: 1500, y: 70 },
        data: {
            title: 'Отправить Email',
            subtitle: 'Уведомить пользователя',
            description: 'Отправляет пользователю уведомление о результате.',
            icon: '✉',
            blockType: 'email',
            status: 'idle',
        },
    },
    {
        id: 'ai-retry',
        type: 'aiBlock',
        position: { x: 1160, y: 350 },
        data: {
            title: 'Повторная AI-функция',
            blockType: 'ai',
            status: 'idle',
            aiConfig: retryAiConfig,
        },
    },
    {
        id: 'action-format',
        type: 'customBlock',
        position: { x: 1540, y: 350 },
        data: {
            title: 'Форматирование',
            subtitle: 'Подготовка результата',
            description: 'Приводит результат к нужному формату.',
            icon: '▰',
            blockType: 'action',
            status: 'idle',
        },
    },
    {
        id: 'log-result',
        type: 'customBlock',
        position: { x: 1880, y: 210 },
        data: {
            title: 'Логирование',
            subtitle: 'Сохранение истории',
            description: 'Сохраняет информацию о выполнении процесса.',
            icon: 'LOG',
            blockType: 'log',
            status: 'idle',
        },
    },
    {
        id: 'end',
        type: 'customBlock',
        position: { x: 2220, y: 210 },
        data: {
            title: 'Конец',
            subtitle: 'Рабочий процесс завершён',
            description: 'Финальная точка выполнения рабочего процесса.',
            icon: '■',
            blockType: 'end',
            status: 'idle',
        },
    },
];

export const initialEdges: Edge[] = [
    {
        id: 'start-ai-main',
        source: 'start',
        target: 'ai-main',
        type: 'smoothstep',
    },
    {
        id: 'ai-main-condition-check',
        source: 'ai-main',
        target: 'condition-check',
        type: 'smoothstep',
    },
    {
        id: 'condition-database-save',
        source: 'condition-check',
        sourceHandle: 'yes',
        target: 'database-save',
        type: 'smoothstep',
        label: 'Да',
    },
    {
        id: 'database-save-email-send',
        source: 'database-save',
        target: 'email-send',
        type: 'smoothstep',
    },
    {
        id: 'email-send-log-result',
        source: 'email-send',
        target: 'log-result',
        type: 'smoothstep',
    },
    {
        id: 'condition-ai-retry',
        source: 'condition-check',
        sourceHandle: 'no',
        target: 'ai-retry',
        type: 'smoothstep',
        label: 'Нет',
    },
    {
        id: 'ai-retry-action-format',
        source: 'ai-retry',
        target: 'action-format',
        type: 'smoothstep',
    },
    {
        id: 'action-format-log-result',
        source: 'action-format',
        target: 'log-result',
        type: 'smoothstep',
    },
    {
        id: 'log-result-end',
        source: 'log-result',
        target: 'end',
        type: 'smoothstep',
    },
];

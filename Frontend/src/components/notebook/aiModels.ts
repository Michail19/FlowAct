export type AiModelOption = {
    id: string;
    name: string;
    provider: string;
    description: string;
};

export const DEFAULT_AI_MODEL_ID = 'openai-gpt-4o';

export const AI_MODEL_OPTIONS: AiModelOption[] = [
    {
        id: 'openai-gpt-4o',
        name: 'GPT-4o',
        provider: 'OpenAI',
        description: 'Универсальная модель для текста и сложной логики.',
    },
    {
        id: 'openai-gpt-4o-mini',
        name: 'GPT-4o mini',
        provider: 'OpenAI',
        description: 'Быстрая модель для простых операций и черновиков.',
    },
    {
        id: 'anthropic-claude-sonnet',
        name: 'Claude Sonnet',
        provider: 'Anthropic',
        description: 'Подходит для анализа, длинных текстов и аккуратных ответов.',
    },
    {
        id: 'google-gemini-pro',
        name: 'Gemini Pro',
        provider: 'Google',
        description: 'Альтернативная модель для генерации и обработки текста.',
    },
    {
        id: 'mistral-large',
        name: 'Mistral Large',
        provider: 'Mistral',
        description: 'Модель для текстовых задач и рассуждений.',
    },
    {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        provider: 'DeepSeek',
        description: 'Модель для диалоговых и программных задач.',
    },
];

export function getAiModelOption(modelId: string): AiModelOption | undefined {
    return AI_MODEL_OPTIONS.find((model) => model.id === modelId);
}

export function getAiModelName(modelId: string): string {
    return getAiModelOption(modelId)?.name ?? modelId;
}

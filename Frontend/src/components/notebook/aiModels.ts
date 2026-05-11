export type AiModelOption = {
    id: string;
    name: string;
    provider: string;
    description: string;
};

export const DEFAULT_AI_MODEL_ID = 'openrouter/free';

export const AI_MODEL_OPTIONS: AiModelOption[] = [
    {
        id: 'openrouter/free',
        name: 'OpenRouter Free Router',
        provider: 'OpenRouter',
        description:
            'Автоматически выбирает доступную бесплатную модель. Лучший вариант для MVP и локального тестирования.',
    },
    {
        id: 'openai/gpt-oss-120b:free',
        name: 'gpt-oss-120b Free',
        provider: 'OpenAI',
        description:
            'Бесплатная open-weight модель OpenAI для сложной логики, рассуждений и агентных сценариев.',
    },
    {
        id: 'openai/gpt-oss-20b:free',
        name: 'gpt-oss-20b Free',
        provider: 'OpenAI',
        description:
            'Более лёгкая бесплатная модель OpenAI для быстрых ответов, черновиков и простых операций.',
    },
    {
        id: 'google/gemma-4-31b-it:free',
        name: 'Gemma 4 31B Free',
        provider: 'Google',
        description:
            'Бесплатная мультимодальная модель Google для текста, анализа документов и работы с изображениями.',
    },
    {
        id: 'z-ai/glm-4.5-air:free',
        name: 'GLM 4.5 Air Free',
        provider: 'Z.ai',
        description:
            'Бесплатная модель для агентных сценариев, рассуждений и автоматизации рабочих процессов.',
    },
    {
        id: 'qwen/qwen3-coder:free',
        name: 'Qwen3 Coder Free',
        provider: 'Qwen',
        description:
            'Бесплатная модель, оптимизированная для кода, tool-use и технических workflow-задач.',
    },
    {
        id: 'minimax/minimax-m2.5:free',
        name: 'MiniMax M2.5 Free',
        provider: 'MiniMax',
        description:
            'Бесплатная модель для офисных, текстовых, табличных и прикладных productivity-задач.',
    },
];

export function getAiModelOption(modelId: string): AiModelOption | undefined {
    return AI_MODEL_OPTIONS.find((model) => model.id === modelId);
}

export function getAiModelName(modelId: string): string {
    return getAiModelOption(modelId)?.name ?? modelId;
}

export function isFreeAiModelId(modelId: string): boolean {
    return modelId === 'openrouter/free' || modelId.endsWith(':free');
}

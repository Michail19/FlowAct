import type {
    NotebookBlockConfig,
    NotebookBlockType,
} from './notebookTypes';

export type NotebookRecommendationSource = 'local-rules' | 'ai';

export type NotebookRecommendationKind =
    | 'next-block'
    | 'autocomplete'
    | 'workflow-fix';

export type NotebookRecommendation = {
    id: string;
    kind: NotebookRecommendationKind;
    source: NotebookRecommendationSource;
    blockType: NotebookBlockType;
    confidence: number;
    reason: string;

    /**
     * Блок, после которого рекомендуется добавить новый блок.
     * Сейчас используется только для пояснения.
     * В следующем пункте можно будет использовать для автосоединения.
     */
    targetBlockId?: string;
    targetBlockTitle?: string;

    /**
     * Будущая возможность: AI/ML Service сможет сразу предложить
     * предзаполненные настройки блока.
     */
    proposedConfig?: NotebookBlockConfig;
};

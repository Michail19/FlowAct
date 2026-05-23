import type { NotebookPayloadDto, NotebookBlockDto } from './notebookBackendTypes';
import type { NotebookBlockConfig, NotebookBlockType } from './notebookTypes';
import type { NotebookRecommendation } from './recommendationTypes';

type NextBlockRule = {
    blockType: NotebookBlockType;
    confidence: number;
    reason: string;
    proposedConfig?: NotebookBlockConfig;
};

const DEFAULT_RECOMMENDATION_LIMIT = 3;

const nextBlockRules: Partial<Record<NotebookBlockType, NextBlockRule>> = {
    start: {
        blockType: 'ai',
        confidence: 78,
        reason:
            'После стартового блока обычно добавляют действие или AI-блок, который начинает обработку входных данных.',
    },
    ai: {
        blockType: 'log',
        confidence: 88,
        reason:
            'После AI-блока полезно добавить логирование, чтобы сохранить ответ модели и проще отлаживать workflow.',
        proposedConfig: {
            log: {
                level: 'info',
                messageTemplate: 'AI result: {{input}}',
            },
        },
    },
    http: {
        blockType: 'condition',
        confidence: 82,
        reason:
            'После HTTP-запроса часто проверяют статус или содержимое ответа и разделяют дальнейший сценарий.',
        proposedConfig: {
            condition: {
                leftValue: 'input.status',
                operator: 'equals',
                rightValue: 'success',
            },
        },
    },
    condition: {
        blockType: 'merge',
        confidence: 72,
        reason:
            'После ветвления удобно добавить блок объединения, чтобы снова собрать разные ветки в один поток.',
    },
    action: {
        blockType: 'log',
        confidence: 76,
        reason:
            'После действия полезно зафиксировать результат, чтобы проверить корректность преобразования данных.',
        proposedConfig: {
            log: {
                level: 'info',
                messageTemplate: 'Action result: {{input}}',
            },
        },
    },
    database: {
        blockType: 'log',
        confidence: 74,
        reason:
            'После операции с базой данных полезно записать результат выполнения или количество обработанных записей.',
        proposedConfig: {
            log: {
                level: 'info',
                messageTemplate: 'Database result: {{input}}',
            },
        },
    },
    email: {
        blockType: 'end',
        confidence: 70,
        reason:
            'После отправки уведомления workflow часто завершается, если дополнительных действий больше не требуется.',
    },
    log: {
        blockType: 'end',
        confidence: 80,
        reason:
            'После логирования результата можно завершить workflow конечным блоком.',
    },
    loop: {
        blockType: 'log',
        confidence: 72,
        reason:
            'После обработки коллекции полезно вывести итог итерации в лог выполнения.',
        proposedConfig: {
            log: {
                level: 'info',
                messageTemplate: 'Loop result: {{input}}',
            },
        },
    },
    merge: {
        blockType: 'log',
        confidence: 73,
        reason:
            'После объединения веток полезно проверить общий результат перед завершением workflow.',
        proposedConfig: {
            log: {
                level: 'info',
                messageTemplate: 'Merged result: {{input}}',
            },
        },
    },
};

function hasBlockOfType(payload: NotebookPayloadDto, blockType: NotebookBlockType) {
    return payload.blocks.some((block) => block.type === blockType);
}

function getOutgoingConnections(payload: NotebookPayloadDto, blockId: string) {
    return payload.connections.filter(
        (connection) => connection.sourceBlockId === blockId,
    );
}

function getIncomingConnections(payload: NotebookPayloadDto, blockId: string) {
    return payload.connections.filter(
        (connection) => connection.targetBlockId === blockId,
    );
}

function getSchemaRevision(payload: NotebookPayloadDto) {
    return `${payload.blocks.length}-${payload.connections.length}`;
}

function withSchemaRevision(
    recommendation: NotebookRecommendation,
    payload: NotebookPayloadDto,
): NotebookRecommendation {
    return {
        ...recommendation,
        id: `${recommendation.id}:${getSchemaRevision(payload)}`,
    };
}

function findFirstDanglingOutputBlock(
    payload: NotebookPayloadDto,
): NotebookBlockDto | null {
    const sortedBlocks = [...payload.blocks].sort((firstBlock, secondBlock) => {
        if (firstBlock.position.x !== secondBlock.position.x) {
            return firstBlock.position.x - secondBlock.position.x;
        }

        if (firstBlock.position.y !== secondBlock.position.y) {
            return firstBlock.position.y - secondBlock.position.y;
        }

        return firstBlock.id.localeCompare(secondBlock.id);
    });

    return (
        sortedBlocks.find((block) => {
            if (block.type === 'end') {
                return false;
            }

            return getOutgoingConnections(payload, block.id).length === 0;
        }) ?? null
    );
}

function findFirstDanglingInputBlock(
    payload: NotebookPayloadDto,
): NotebookBlockDto | null {
    const sortedBlocks = [...payload.blocks].sort((firstBlock, secondBlock) => {
        if (firstBlock.position.x !== secondBlock.position.x) {
            return firstBlock.position.x - secondBlock.position.x;
        }

        if (firstBlock.position.y !== secondBlock.position.y) {
            return firstBlock.position.y - secondBlock.position.y;
        }

        return firstBlock.id.localeCompare(secondBlock.id);
    });

    return (
        sortedBlocks.find((block) => {
            if (block.type === 'start') {
                return false;
            }

            return getIncomingConnections(payload, block.id).length === 0;
        }) ?? null
    );
}

function createRecommendationId(parts: string[]) {
    return parts
        .join(':')
        .replace(/[^a-zA-Z0-9:_-]/g, '-')
        .toLowerCase();
}

function createMissingStartRecommendation(): NotebookRecommendation {
    return {
        id: 'local-rules:workflow-fix:start-missing',
        kind: 'workflow-fix',
        source: 'local-rules',
        blockType: 'start',
        confidence: 96,
        reason:
            'В workflow нет стартового блока. Для запуска схемы нужна начальная точка выполнения.',
    };
}

function createMissingEndRecommendation(): NotebookRecommendation {
    return {
        id: 'local-rules:workflow-fix:end-missing',
        kind: 'workflow-fix',
        source: 'local-rules',
        blockType: 'end',
        confidence: 92,
        reason:
            'В workflow нет конечного блока. Добавьте финальную точку, чтобы явно завершить выполнение.',
    };
}

function createConnectPreviousRecommendation(
    block: NotebookBlockDto,
): NotebookRecommendation {
    return {
        id: createRecommendationId([
            'local-rules',
            'workflow-fix',
            block.id,
            'start',
        ]),
        kind: 'workflow-fix',
        source: 'local-rules',
        blockType: 'start',
        targetBlockId: block.id,
        targetBlockTitle: block.title,
        confidence: 68,
        reason:
            `У блока «${block.title}» нет входящей связи. ` +
            'Можно добавить стартовый блок или соединить его с предыдущим шагом.',
    };
}

function createNextBlockRecommendation(
    block: NotebookBlockDto,
): NotebookRecommendation | null {
    const rule = nextBlockRules[block.type];

    if (!rule) {
        return {
            id: createRecommendationId([
                'local-rules',
                'next-block',
                block.id,
                'action',
            ]),
            kind: 'next-block',
            source: 'local-rules',
            blockType: 'action',
            targetBlockId: block.id,
            targetBlockTitle: block.title,
            confidence: 60,
            reason:
                `У блока «${block.title}» нет продолжения. ` +
                'Можно добавить универсальное действие как следующий шаг workflow.',
        };
    }

    return {
        id: createRecommendationId([
            'local-rules',
            'next-block',
            block.id,
            rule.blockType,
        ]),
        kind: 'next-block',
        source: 'local-rules',
        blockType: rule.blockType,
        targetBlockId: block.id,
        targetBlockTitle: block.title,
        confidence: rule.confidence,
        reason: rule.reason,
        proposedConfig: rule.proposedConfig,
    };
}

export function getBlockAutocompleteRecommendation(
    payload: NotebookPayloadDto | null | undefined,
    blockId: string,
): NotebookRecommendation | null {
    if (!payload) {
        return null;
    }

    const block = payload.blocks.find((currentBlock) => currentBlock.id === blockId);

    if (!block || block.type === 'end') {
        return null;
    }

    const recommendation = createNextBlockRecommendation(block);

    if (!recommendation) {
        return null;
    }

    return {
        ...recommendation,
        id: recommendation.id.replace(':next-block:', ':autocomplete:'),
        kind: 'autocomplete',
    };
}

export function getLocalNotebookRecommendations(
    payload: NotebookPayloadDto | null | undefined,
    limit = DEFAULT_RECOMMENDATION_LIMIT,
): NotebookRecommendation[] {
    if (!payload) {
        return [];
    }

    const recommendations: NotebookRecommendation[] = [];

    if (payload.blocks.length === 0) {
        recommendations.push(createMissingStartRecommendation());
        recommendations.push(createMissingEndRecommendation());

        return recommendations
            .map((recommendation) => withSchemaRevision(recommendation, payload))
            .slice(0, limit);
    }

    if (!hasBlockOfType(payload, 'start')) {
        recommendations.push(createMissingStartRecommendation());
    }

    if (!hasBlockOfType(payload, 'end')) {
        recommendations.push(createMissingEndRecommendation());
    }

    const danglingOutputBlock = findFirstDanglingOutputBlock(payload);

    if (danglingOutputBlock) {
        const recommendation = createNextBlockRecommendation(danglingOutputBlock);

        if (recommendation) {
            recommendations.push(recommendation);
        }
    }

    const danglingInputBlock = findFirstDanglingInputBlock(payload);

    if (danglingInputBlock) {
        recommendations.push(createConnectPreviousRecommendation(danglingInputBlock));
    }

    const uniqueRecommendations = new Map<string, NotebookRecommendation>();

    recommendations.forEach((recommendation) => {
        uniqueRecommendations.set(recommendation.id, recommendation);
    });

    return Array.from(uniqueRecommendations.values())
        .map((recommendation) => withSchemaRevision(recommendation, payload))
        .sort((firstRecommendation, secondRecommendation) => {
            return secondRecommendation.confidence - firstRecommendation.confidence;
        })
        .slice(0, limit);
}

export function getPrimaryLocalNotebookRecommendation(
    payload: NotebookPayloadDto | null | undefined,
): NotebookRecommendation | null {
    return getLocalNotebookRecommendations(payload, 1)[0] ?? null;
}

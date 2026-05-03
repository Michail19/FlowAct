import type {
    NotebookBlockDto,
    NotebookConnectionDto,
    NotebookPayloadDto,
} from './notebookBackendTypes';
import type { NotebookBlockType } from './notebookTypes';
import type {
    BackendBlockType,
    BackendJsonObject,
    BackendJsonValue,
    BackendWorkflowBlockRequest,
    BackendWorkflowConnectionRequest,
    BackendWorkflowUpsertRequest,
} from '../../services/workflowApiTypes';

const UUID_REGEXP =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
    return UUID_REGEXP.test(value);
}

function createHashHex(input: string) {
    let result = '';

    for (let salt = 0; salt < 4; salt += 1) {
        let hash = 2166136261 + salt;

        for (let index = 0; index < input.length; index += 1) {
            hash ^= input.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }

        result += (hash >>> 0).toString(16).padStart(8, '0');
    }

    return result.slice(0, 32);
}

function createStableUuidFromString(input: string) {
    const hex = createHashHex(input);
    const variant = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);

    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        `4${hex.slice(13, 16)}`,
        `${variant}${hex.slice(17, 20)}`,
        hex.slice(20, 32),
    ].join('-');
}

function toBackendUuid(value: string, namespace: string) {
    if (isUuid(value)) {
        return value;
    }

    return createStableUuidFromString(`${namespace}:${value}`);
}

function parseJsonValue(value: string): BackendJsonValue {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
        return null;
    }

    try {
        return JSON.parse(trimmedValue) as BackendJsonValue;
    } catch {
        return trimmedValue;
    }
}

function parseJsonObject(value: string): BackendJsonObject {
    const parsedValue = parseJsonValue(value);

    if (
        parsedValue &&
        typeof parsedValue === 'object' &&
        !Array.isArray(parsedValue)
    ) {
        return parsedValue as BackendJsonObject;
    }

    return {};
}

function mapFrontendBlockTypeToBackendBlockType(
    blockType: NotebookBlockType,
): BackendBlockType {
    switch (blockType) {
        case 'start':
            return 'START';

        case 'end':
            return 'END';

        case 'ai':
            return 'LLM_REQUEST';

        case 'condition':
            return 'IF';

        case 'action':
            return 'TRANSFORM_JSON';

        case 'http':
            return 'HTTP_REQUEST';

        case 'merge':
            return 'MERGE';

        /*
         * Важно:
         * backend BlockType содержит MAP, но текущий MapNodeHandler поддерживает
         * только pick/rename, а не полноценный loop. Поэтому loop пока отправляем
         * как INPUT/pass-through, чтобы не ломать выполнение.
         */
        case 'loop':
            return 'INPUT';

        /*
         * Для database/email/log в WorkerService пока нет отдельных BlockType.
         * Отправляем как INPUT/pass-through и сохраняем frontendType в config.
         */
        case 'database':
        case 'email':
        case 'log':
            return 'INPUT';

        default:
            return 'INPUT';
    }
}

function getVariableNameFromConditionLeftValue(leftValue: string) {
    if (leftValue.startsWith('variables.')) {
        return leftValue.replace('variables.', '');
    }

    return undefined;
}

function getInputKeyFromConditionLeftValue(leftValue: string) {
    if (leftValue.startsWith('input.')) {
        return leftValue.replace('input.', '');
    }

    return leftValue;
}

function createBaseBlockConfig(block: NotebookBlockDto): BackendJsonObject {
    return {
        frontend: {
            id: block.id,
            type: block.type,
            subtitle: block.subtitle ?? null,
            description: block.description ?? null,
        },
    };
}

function createBackendBlockConfig(block: NotebookBlockDto): BackendJsonObject {
    const baseConfig = createBaseBlockConfig(block);

    if (block.type === 'ai') {
        return {
            ...baseConfig,
            prompt: block.config?.ai?.prompt ?? '',
            models: block.config?.ai?.models ?? [],
        };
    }

    if (block.type === 'condition') {
        const condition = block.config?.condition;
        const leftValue = condition?.leftValue ?? '';

        return {
            ...baseConfig,
            variableName: getVariableNameFromConditionLeftValue(leftValue),
            inputKey: getInputKeyFromConditionLeftValue(leftValue),
            operator: condition?.operator ?? 'exists',
            expectedValue: condition?.rightValue ?? '',
            frontendCondition: condition
                ? {
                    leftValue: condition.leftValue,
                    operator: condition.operator,
                    rightValue: condition.rightValue,
                }
                : null,
        };
    }

    if (block.type === 'action') {
        return {
            ...baseConfig,
            actionType: block.config?.action?.actionType ?? 'transform',
            parameters: block.config?.action?.parameters ?? '',
        };
    }

    if (block.type === 'http') {
        const http = block.config?.http;

        return {
            ...baseConfig,
            method: http?.method ?? 'GET',
            url: http?.url ?? '',
            headers: http?.headers ? parseJsonObject(http.headers) : {},
            body: http?.body ? parseJsonValue(http.body) : null,
        };
    }

    if (block.type === 'loop') {
        return {
            ...baseConfig,
            collectionPath: block.config?.loop?.collectionPath ?? 'input.items',
            itemName: block.config?.loop?.itemName ?? 'item',
            mode: block.config?.loop?.mode ?? 'map',
        };
    }

    if (block.type === 'merge') {
        return {
            ...baseConfig,
            mode: block.config?.merge?.mode ?? 'combine',
        };
    }

    if (block.type === 'database') {
        return {
            ...baseConfig,
            operation: block.config?.database?.operation ?? 'select',
            tableName: block.config?.database?.tableName ?? '',
            query: block.config?.database?.query ?? '',
            payload: block.config?.database?.payload
                ? parseJsonValue(block.config.database.payload)
                : null,
        };
    }

    if (block.type === 'email') {
        return {
            ...baseConfig,
            recipient: block.config?.email?.recipient ?? '',
            subject: block.config?.email?.subject ?? '',
            body: block.config?.email?.body ?? '',
        };
    }

    if (block.type === 'log') {
        return {
            ...baseConfig,
            level: block.config?.log?.level ?? 'info',
            messageTemplate: block.config?.log?.messageTemplate ?? '{{result}}',
        };
    }

    return baseConfig;
}

function getBackendConditionForConnection(
    connection: NotebookConnectionDto,
    sourceBlock?: NotebookBlockDto,
) {
    if (sourceBlock?.type !== 'condition') {
        return null;
    }

    if (connection.sourceHandle === 'yes' || connection.label === 'Да') {
        return 'true';
    }

    if (connection.sourceHandle === 'no' || connection.label === 'Нет') {
        return 'false';
    }

    return null;
}

export function toBackendWorkflowRequest(
    payload: NotebookPayloadDto,
): BackendWorkflowUpsertRequest {
    const namespace = payload.id ?? payload.title;
    const blockById = new Map(payload.blocks.map((block) => [block.id, block]));

    const blocks: BackendWorkflowBlockRequest[] = payload.blocks.map((block) => ({
        id: toBackendUuid(block.id, `${namespace}:block`),
        type: mapFrontendBlockTypeToBackendBlockType(block.type),
        name: block.title,
        position: {
            x: block.position.x,
            y: block.position.y,
        },
        config: createBackendBlockConfig(block),
    }));

    const connections: BackendWorkflowConnectionRequest[] = payload.connections.map(
        (connection) => {
            const sourceBlock = blockById.get(connection.sourceBlockId);

            return {
                id: toBackendUuid(connection.id, `${namespace}:connection`),
                fromBlockId: toBackendUuid(
                    connection.sourceBlockId,
                    `${namespace}:block`,
                ),
                toBlockId: toBackendUuid(
                    connection.targetBlockId,
                    `${namespace}:block`,
                ),
                condition: getBackendConditionForConnection(connection, sourceBlock),
            };
        },
    );

    return {
        id: payload.id ? toBackendUuid(payload.id, 'workflow') : undefined,
        name: payload.title,
        blocks,
        connections,
        metadata: {
            frontendVersion: payload.version,
            frontendUpdatedAt: payload.updatedAt,
            viewport: payload.viewport
                ? {
                    x: payload.viewport.x,
                    y: payload.viewport.y,
                    zoom: payload.viewport.zoom,
                }
                : undefined,
        },
    };
}

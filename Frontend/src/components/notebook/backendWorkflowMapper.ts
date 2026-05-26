import { getBlockDefinition } from './blockLibrary';
import type {
    NotebookBlockConfigDto,
    NotebookBlockDto,
    NotebookConnectionDto,
    NotebookPayloadDto,
} from './notebookBackendTypes';
import type {
    ActionBlockConfig, AiBlockConfig,
    ConditionBlockConfig,
    DatabaseBlockConfig,
    HttpBlockConfig,
    LogBlockConfig,
    LoopBlockConfig,
    MergeBlockConfig,
    NotebookBlockType,
} from './notebookTypes';
import type { NotebookResponse } from '../../services/notebookApi';
import {
    DEFAULT_AI_MODEL_ID,
    isFreeAiModelId,
} from './aiModels';
import type {
    BackendBlockType,
    BackendJsonObject,
    BackendJsonValue,
    BackendWorkflowBlockRequest,
    BackendWorkflowConnectionRequest,
    BackendWorkflowUpsertRequest,
    WorkflowResponse,
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

function createStableId(input: string) {
    return createStableUuidFromString(input);
}

function toBackendUuid(value: string, namespace: string) {
    if (isUuid(value)) {
        return value;
    }

    return createStableId(`${namespace}:${value}`);
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

        case 'loop':
            return 'MAP';

        case 'database':
            return 'DATABASE_QUERY';

        case 'email':
            return 'EMAIL_SEND';

        case 'log':
            return 'LOG_MESSAGE';

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

const LEGACY_FREE_MODEL_ALIASES: Record<string, string> = {
    'openai-gpt-4o': 'openai/gpt-oss-120b:free',
    'openai-gpt-4o-mini': 'openai/gpt-oss-20b:free',
    'anthropic-claude-sonnet': DEFAULT_AI_MODEL_ID,
    'google-gemini-pro': 'google/gemma-4-31b-it:free',
    'mistral-large': DEFAULT_AI_MODEL_ID,
    'deepseek-chat': DEFAULT_AI_MODEL_ID,
};

function normalizeAiModels(models?: string[]) {
    const normalizedModels = Array.from(
        new Set(
            (models ?? [])
                .map((modelId) => LEGACY_FREE_MODEL_ALIASES[modelId] ?? modelId)
                .filter(isFreeAiModelId),
        ),
    );

    if (normalizedModels.length > 0) {
        return normalizedModels;
    }

    return [DEFAULT_AI_MODEL_ID];
}

function createBackendBlockConfig(block: NotebookBlockDto): BackendJsonObject {
    const baseConfig = createBaseBlockConfig(block);

    if (block.type === 'ai') {
        const models = normalizeAiModels(block.config?.ai?.models);

        return {
            ...baseConfig,
            prompt: block.config?.ai?.prompt ?? '',
            model: models[0],
            models,
            inputMode: block.config?.ai?.inputMode ?? 'smart',
            maxInputChars: block.config?.ai?.maxInputChars ?? 12000,
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
            timeoutMs: http?.timeoutMs ?? 10000,
            maxResponseChars: http?.maxResponseChars ?? 50000,
            responseMode: http?.responseMode ?? 'auto',
            continueOnError: http?.continueOnError ?? false,
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
            messageTemplate: block.config?.log?.messageTemplate ?? '{{value}}',
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

    const normalizedLabel = connection.label?.trim().toLowerCase();

    if (
        connection.sourceHandle === 'yes' ||
        normalizedLabel === 'да' ||
        normalizedLabel === 'yes' ||
        normalizedLabel === 'true' ||
        normalizedLabel?.startsWith('да:')
    ) {
        return 'true';
    }

    if (
        connection.sourceHandle === 'no' ||
        normalizedLabel === 'нет' ||
        normalizedLabel === 'no' ||
        normalizedLabel === 'false' ||
        normalizedLabel?.startsWith('нет:')
    ) {
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
        id: payload.workflowId
            ? toBackendUuid(payload.workflowId, 'workflow')
            : undefined,
        notebookId: payload.serverNotebookId,
        name: payload.title,
        blocks,
        connections,
        metadata: {
            frontendVersion: payload.version,
            frontendUpdatedAt: payload.updatedAt,
            localNotebookId: payload.id,
            description: '',
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

const FRONTEND_BLOCK_TYPES = [
    'start',
    'end',
    'ai',
    'condition',
    'action',
    'database',
    'email',
    'log',
    'http',
    'loop',
    'merge',
] as const satisfies NotebookBlockType[];

function isFrontendBlockType(value: unknown): value is NotebookBlockType {
    return (
        typeof value === 'string' &&
        FRONTEND_BLOCK_TYPES.includes(value as NotebookBlockType)
    );
}

function isBackendJsonObject(value: BackendJsonValue | undefined): value is BackendJsonObject {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getConfigObject(
    config: BackendJsonObject,
    key: string,
): BackendJsonObject | undefined {
    const value = config[key];

    return isBackendJsonObject(value) ? value : undefined;
}

function getConfigString(
    config: BackendJsonObject | undefined,
    key: string,
    fallback = '',
): string {
    const value = config?.[key];

    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    return fallback;
}

function getConfigStringArray(
    config: BackendJsonObject | undefined,
    key: string,
): string[] {
    const value = config?.[key];

    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
}

function stringifyForTextarea(value: BackendJsonValue | undefined, fallback = '') {
    if (value === undefined || value === null) {
        return fallback;
    }

    if (typeof value === 'string') {
        return value;
    }

    return JSON.stringify(value, null, 2);
}

function getNumberFromPosition(
    position: BackendWorkflowBlockRequest['position'],
    key: 'x' | 'y',
): number {
    const value = position[key];

    return typeof value === 'number' ? value : Number(value) || 0;
}

function getFrontendConfig(blockConfig: BackendJsonObject): BackendJsonObject | undefined {
    return getConfigObject(blockConfig, 'frontend');
}

function getFrontendBlockTypeFromBackendBlock(
    block: BackendWorkflowBlockRequest,
): NotebookBlockType {
    const frontendConfig = getFrontendConfig(block.config);
    const frontendType = frontendConfig?.type;

    if (isFrontendBlockType(frontendType)) {
        return frontendType;
    }

    switch (block.type) {
        case 'START':
            return 'start';

        case 'END':
            return 'end';

        case 'IF':
            return 'condition';

        case 'MERGE':
            return 'merge';

        case 'HTTP_REQUEST':
            return 'http';

        case 'LLM_REQUEST':
        case 'ML_REQUEST':
            return 'ai';

        case 'DATABASE_QUERY':
            return 'database';

        case 'EMAIL_SEND':
            return 'email';

        case 'LOG_MESSAGE':
            return 'log';

        case 'TRANSFORM_JSON':
        case 'SET_VARIABLE':
        case 'MAP':
        case 'FILTER':
            return 'action';

        case 'INPUT':
        default:
            return 'action';
    }
}

function getFrontendBlockIdFromBackendBlock(block: BackendWorkflowBlockRequest) {
    const frontendConfig = getFrontendConfig(block.config);
    const frontendId = frontendConfig?.id;

    return typeof frontendId === 'string' && frontendId.trim()
        ? frontendId
        : block.id;
}

function createConditionConfigFromBackendConfig(
    config: BackendJsonObject,
): NotebookBlockConfigDto['condition'] {
    const frontendCondition = getConfigObject(config, 'frontendCondition');

    if (frontendCondition) {
        return {
            leftValue: getConfigString(frontendCondition, 'leftValue', 'value'),
            operator:
                getConfigString(frontendCondition, 'operator', 'exists') as ConditionBlockConfig['operator'],
            rightValue: getConfigString(frontendCondition, 'rightValue'),
        };
    }

    const variableName = getConfigString(config, 'variableName');
    const inputKey = getConfigString(config, 'inputKey', 'value');

    return {
        leftValue: variableName ? `variables.${variableName}` : inputKey,
        operator: 'exists',
        rightValue: getConfigString(config, 'expectedValue'),
    };
}

function createFrontendBlockConfigFromBackendBlock(
    block: BackendWorkflowBlockRequest,
    frontendType: NotebookBlockType,
): NotebookBlockConfigDto | undefined {
    const config = block.config;

    if (frontendType === 'ai') {
        return {
            ai: {
                prompt: getConfigString(config, 'prompt'),
                models:
                    getConfigStringArray(config, 'models').length > 0
                        ? getConfigStringArray(config, 'models')
                        : [getConfigString(config, 'model', DEFAULT_AI_MODEL_ID)],
                inputMode:
                    getConfigString(config, 'inputMode', 'smart') as AiBlockConfig['inputMode'],
                maxInputChars:
                    Number(config.maxInputChars) || 12000,
            },
        };
    }

    if (frontendType === 'condition') {
        return {
            condition: createConditionConfigFromBackendConfig(config),
        };
    }

    if (frontendType === 'action') {
        return {
            action: {
                actionType:
                    getConfigString(config, 'actionType', 'transform') as ActionBlockConfig['actionType'],
                parameters: getConfigString(config, 'parameters'),
            },
        };
    }

    if (frontendType === 'http') {
        return {
            http: {
                method:
                    getConfigString(config, 'method', 'GET') as HttpBlockConfig['method'],
                url: getConfigString(config, 'url'),
                headers: stringifyForTextarea(config.headers, '{}'),
                body: stringifyForTextarea(config.body),
                timeoutMs: Number(config.timeoutMs) || 10000,
                maxResponseChars: Number(config.maxResponseChars) || 50000,
                responseMode:
                    getConfigString(config, 'responseMode', 'auto') as HttpBlockConfig['responseMode'],
                continueOnError: config.continueOnError === true,
            },
        };
    }

    if (frontendType === 'loop') {
        return {
            loop: {
                collectionPath: getConfigString(config, 'collectionPath', 'value.items'),
                itemName: getConfigString(config, 'itemName', 'item'),
                mode:
                    getConfigString(config, 'mode', 'map') as LoopBlockConfig['mode'],
            },
        };
    }

    if (frontendType === 'merge') {
        return {
            merge: {
                mode:
                    getConfigString(config, 'mode', 'combine') as MergeBlockConfig['mode'],
            },
        };
    }

    if (frontendType === 'database') {
        return {
            database: {
                operation:
                    getConfigString(config, 'operation', 'select') as DatabaseBlockConfig['operation'],
                tableName: getConfigString(config, 'tableName'),
                query: getConfigString(config, 'query'),
                payload: stringifyForTextarea(config.payload),
            },
        };
    }

    if (frontendType === 'email') {
        return {
            email: {
                recipient: getConfigString(config, 'recipient'),
                subject: getConfigString(config, 'subject'),
                body: getConfigString(config, 'body'),
            },
        };
    }

    if (frontendType === 'log') {
        return {
            log: {
                level:
                    getConfigString(config, 'level', 'info') as LogBlockConfig['level'],
                messageTemplate: getConfigString(config, 'messageTemplate', '{{value}}'),
            },
        };
    }

    return undefined;
}

function getConnectionLabelFromBackendCondition(condition?: string | null) {
    if (condition === 'true') {
        return 'Да';
    }

    if (condition === 'false') {
        return 'Нет';
    }

    return undefined;
}

function getConnectionSourceHandleFromBackendCondition(condition?: string | null) {
    if (condition === 'true') {
        return 'yes';
    }

    if (condition === 'false') {
        return 'no';
    }

    return undefined;
}

function getViewportFromWorkflowMetadata(
    metadata: BackendJsonObject | null | undefined,
    fallbackPayload?: NotebookPayloadDto | null,
) {
    const viewport = metadata?.viewport;

    if (
        viewport &&
        typeof viewport === 'object' &&
        !Array.isArray(viewport)
    ) {
        const viewportObject = viewport as BackendJsonObject;
        const x = Number(viewportObject.x);
        const y = Number(viewportObject.y);
        const zoom = Number(viewportObject.zoom);

        if (
            Number.isFinite(x) &&
            Number.isFinite(y) &&
            Number.isFinite(zoom)
        ) {
            return { x, y, zoom };
        }
    }

    return fallbackPayload?.viewport;
}

type FromBackendWorkflowResponseParams = {
    localNotebookId?: string;
    workflow: WorkflowResponse;
    notebook: NotebookResponse;
    fallbackPayload?: NotebookPayloadDto | null;
};

export function fromBackendWorkflowResponse({
    localNotebookId,
    workflow,
    notebook,
    fallbackPayload,
}: FromBackendWorkflowResponseParams): NotebookPayloadDto {
    const blocks: NotebookBlockDto[] = workflow.blocks.map((block) => {
        const frontendType = getFrontendBlockTypeFromBackendBlock(block);
        const definition = getBlockDefinition(frontendType);
        const frontendConfig = getFrontendConfig(block.config);

        return {
            id: getFrontendBlockIdFromBackendBlock(block),
            type: frontendType,
            title: block.name || definition.title,
            subtitle:
                getConfigString(frontendConfig, 'subtitle') ||
                fallbackPayload?.blocks.find(
                    (fallbackBlock) =>
                        fallbackBlock.id === getFrontendBlockIdFromBackendBlock(block),
                )?.subtitle ||
                definition.subtitle,
            description:
                getConfigString(frontendConfig, 'description') ||
                fallbackPayload?.blocks.find(
                    (fallbackBlock) =>
                        fallbackBlock.id === getFrontendBlockIdFromBackendBlock(block),
                )?.description ||
                definition.description,
            position: {
                x: getNumberFromPosition(block.position, 'x'),
                y: getNumberFromPosition(block.position, 'y'),
            },
            config: createFrontendBlockConfigFromBackendBlock(block, frontendType),
        };
    });

    const connections: NotebookConnectionDto[] = workflow.connections.map((connection) => ({
        id: connection.id,
        sourceBlockId: getFrontendBlockIdFromBackendBlock(
            workflow.blocks.find((block) => block.id === connection.fromBlockId) ?? {
                id: connection.fromBlockId,
                type: 'INPUT',
                name: '',
                position: { x: 0, y: 0 },
                config: {},
            },
        ),
        targetBlockId: getFrontendBlockIdFromBackendBlock(
            workflow.blocks.find((block) => block.id === connection.toBlockId) ?? {
                id: connection.toBlockId,
                type: 'INPUT',
                name: '',
                position: { x: 0, y: 0 },
                config: {},
            },
        ),
        label: getConnectionLabelFromBackendCondition(connection.condition),
        sourceHandle: getConnectionSourceHandleFromBackendCondition(connection.condition),
    }));

    return {
        id: localNotebookId ?? fallbackPayload?.id ?? notebook.id,
        serverNotebookId: notebook.id,
        workflowId: workflow.id,
        workflowStatus: workflow.status,
        title: notebook.name,
        version: fallbackPayload?.version ?? 1,
        updatedAt: workflow.updatedAt ?? notebook.updatedAt,
        blocks,
        connections,
        viewport: getViewportFromWorkflowMetadata(workflow.metadata, fallbackPayload),
    };
}

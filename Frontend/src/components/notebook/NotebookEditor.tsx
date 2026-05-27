import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useMediaQuery } from '../../hooks/useMediaQuery';

import NotebookHeader from './NotebookHeader';
import NotebookToolbar from './NotebookToolbar';
import NotebookCanvas from './NotebookCanvas';
import NotebookSearch from './NotebookSearch';
import NotebookSuggestion from './NotebookSuggestion';
import NotebookMobileActions from './NotebookMobileActions';
import type {
    NotebookAutoLayoutMode,
    NotebookAutoLayoutRequest,
    NotebookBlockRequest,
    NotebookBlockStatus,
    NotebookBlockType,
    NotebookHistoryRequest,
    NotebookHistoryState,
    NotebookSearchRequest,
    NotebookSearchResult,
    NotebookViewportRequest,
    NotebookZoomValue,
} from './notebookTypes';
import type { NotebookPayloadDto } from './notebookBackendTypes';
import { notebookApi } from '../../services/notebookApi';
import {
    loadNotebookLocally,
    saveNotebookLocally,
} from '../../services/notebookStorage';
import NotebookRunPanel from './NotebookRunPanel';
import NotebookBlockInspector from './NotebookBlockInspector';
import type {
    NotebookBlockInspectionTarget,
    NotebookExecutionLog,
    WorkflowExecutionResult,
    WorkflowExecutionStatus,
    WorkflowExecutionTarget,
    WorkflowRunRequest,
} from './executionTypes';
import {
    fromBackendWorkflowResponse,
    toBackendWorkflowRequest,
} from './backendWorkflowMapper';
import { workflowApi } from '../../services/workflowApi';
import { createExecutionLog, sleep } from './workflowExecution';
import { ApiError } from '../../services/apiClient';
import type {
    ExecutionLogResponse,
    WorkflowResponse,
    WorkflowStatus,
    WorkflowValidationResponse,
} from '../../services/workflowApiTypes';
import {
    validateNotebookPayload,
    type WorkflowValidationIssue,
} from './workflowValidation';
import { mlRecommendationApi } from '../../services/mlRecommendationApi';
import { executionApi } from '../../services/executionApi';
import {
    toNotebookExecutionLog,
    toWorkflowExecutionResult,
} from './executionApiMapper';
import {
    mapApiExecutionLogStatus,
    mapApiExecutionStatus,
} from './executionTypes';
import {
    getBlockAutocompleteRecommendation,
    getLocalNotebookRecommendations,
} from './recommendationService';
import type { NotebookRecommendation } from './recommendationTypes';

import './NotebookEditor.css';

type NotebookEditorProps = {
    notebookId: string;
};

function getApiPayloadMessage(payload: unknown): string | null {
    if (!payload) {
        return null;
    }

    if (typeof payload === 'string') {
        return payload;
    }

    if (typeof payload !== 'object') {
        return null;
    }

    const payloadObject = payload as Record<string, unknown>;

    const message =
        payloadObject.message ??
        payloadObject.error ??
        payloadObject.detail ??
        payloadObject.title;

    return typeof message === 'string' && message.trim()
        ? message
        : null;
}

function getBackendSaveErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
        const payloadMessage = getApiPayloadMessage(error.payload);

        if (payloadMessage) {
            return `Не удалось сохранить workflow: ${payloadMessage}`;
        }

        if (error.status === 400) {
            return 'Не удалось сохранить workflow: backend отклонил данные схемы.';
        }

        if (error.status === 404) {
            return 'Не удалось сохранить workflow: notebook или workflow не найден на backend.';
        }

        if (error.status === 409) {
            return 'Не удалось сохранить workflow: конфликт состояния данных.';
        }

        if (error.status >= 500) {
            return 'Не удалось сохранить workflow: внутренняя ошибка backend.';
        }

        return `Не удалось сохранить workflow: HTTP ${error.status}.`;
    }

    if (error instanceof Error) {
        return `Не удалось сохранить workflow: ${error.message}`;
    }

    return 'Не удалось сохранить workflow.';
}

function normalizePayloadForStatus(payload: NotebookPayloadDto | null | undefined) {
    if (!payload) {
        return null;
    }

    return {
        title: payload.title,
        blocks: payload.blocks.map((block) => ({
            id: block.id,
            type: block.type,
            title: block.title,
            subtitle: block.subtitle ?? '',
            description: block.description ?? '',
            position: block.position,
            config: block.config ?? {},
        })),
        connections: payload.connections.map((connection) => ({
            id: connection.id,
            sourceBlockId: connection.sourceBlockId,
            targetBlockId: connection.targetBlockId,
            sourceHandle: connection.sourceHandle ?? '',
            targetHandle: connection.targetHandle ?? '',
            label: connection.label ?? '',
        })),
        viewport: payload.viewport ?? null,
    };
}

function getPayloadFingerprint(payload: NotebookPayloadDto | null | undefined) {
    return JSON.stringify(normalizePayloadForStatus(payload));
}

function getBlockingValidationIssues(issues: WorkflowValidationIssue[]) {
    return issues.filter((issue) => issue.severity === 'error');
}

function getValidationErrorSummary(issues: WorkflowValidationIssue[]) {
    const blockingIssues = getBlockingValidationIssues(issues);
    const firstIssue = blockingIssues[0];

    if (!firstIssue) {
        return null;
    }

    if (blockingIssues.length === 1) {
        return firstIssue.message;
    }

    return `${firstIssue.message}\n\nИ ещё ошибок: ${blockingIssues.length - 1}`;
}

function getValidationResultSummary(issues: WorkflowValidationIssue[]) {
    const errorsCount = issues.filter((issue) => issue.severity === 'error').length;
    const warningsCount = issues.filter((issue) => issue.severity === 'warning').length;

    if (errorsCount === 0 && warningsCount === 0) {
        return 'Схема готова к запуску';
    }

    if (errorsCount > 0) {
        return `Схема содержит ошибки: ${errorsCount}`;
    }

    return `Схема содержит предупреждения: ${warningsCount}`;
}

function getFrontendBlockIdFromBackendExecutionBlock(
    workflow: WorkflowResponse,
    backendBlockId: string,
) {
    const backendBlock = workflow.blocks.find((block) => block.id === backendBlockId);

    if (!backendBlock) {
        return backendBlockId;
    }

    const frontendConfig = backendBlock.config.frontend;

    if (
        frontendConfig &&
        typeof frontendConfig === 'object' &&
        !Array.isArray(frontendConfig)
    ) {
        const frontendId = frontendConfig.id;

        if (typeof frontendId === 'string' && frontendId.trim()) {
            return frontendId;
        }
    }

    return backendBlockId;
}

function getMissingBlockFallbackStatus(
    executionStatus?: WorkflowExecutionStatus,
): NotebookBlockStatus {
    if (executionStatus === 'success') {
        return 'skipped';
    }

    if (executionStatus === 'error' || executionStatus === 'cancelled') {
        return 'idle';
    }

    if (
        executionStatus === 'created' ||
        executionStatus === 'validating' ||
        executionStatus === 'pending' ||
        executionStatus === 'ready' ||
        executionStatus === 'running'
    ) {
        return 'pending';
    }

    if (executionStatus === 'waiting') {
        return 'pending';
    }

    return 'idle';
}

function applyExecutionStatusesToPayload(params: {
    payload: NotebookPayloadDto;
    workflow: WorkflowResponse;
    logs: ExecutionLogResponse[];
    shouldApplyBlockStatuses: boolean;
    executionStatus?: WorkflowExecutionStatus;
}): NotebookPayloadDto {
    if (!params.shouldApplyBlockStatuses) {
        return {
            ...params.payload,
            blocks: params.payload.blocks.map((block) => ({
                ...block,
                status: 'idle',
            })),
        };
    }

    const blockStatusByFrontendId = new Map<string, NotebookBlockStatus>();

    params.logs.forEach((log) => {
        const frontendBlockId = getFrontendBlockIdFromBackendExecutionBlock(
            params.workflow,
            log.blockId,
        );

        blockStatusByFrontendId.set(
            frontendBlockId,
            mapApiExecutionLogStatus(log.status),
        );
    });

    const missingBlockFallbackStatus = getMissingBlockFallbackStatus(
        params.executionStatus,
    );

    return {
        ...params.payload,
        blocks: params.payload.blocks.map((block) => ({
            ...block,
            status:
                blockStatusByFrontendId.get(block.id) ??
                missingBlockFallbackStatus,
        })),
    };
}

function mapExecutionLogsToNotebookLogs(params: {
    payload: NotebookPayloadDto;
    workflow: WorkflowResponse;
    logs: ExecutionLogResponse[];
}): NotebookExecutionLog[] {
    const blockTitleById = new Map(
        params.payload.blocks.map((block) => [block.id, block.title]),
    );

    return params.logs.map((log) => {
        const frontendBlockId = getFrontendBlockIdFromBackendExecutionBlock(
            params.workflow,
            log.blockId,
        );

        return {
            ...toNotebookExecutionLog({
                ...log,
                blockId: frontendBlockId,
            }),
            blockTitle: blockTitleById.get(frontendBlockId),
        };
    });
}

const RESTORE_EXECUTION_POLL_INTERVAL_MS = 1000;
const RESTORE_EXECUTION_MAX_POLLS = 120;
const ML_RECOMMENDATION_DEBOUNCE_MS = 600;

function isRestoredExecutionFinished(status: WorkflowExecutionStatus) {
    return status === 'success' || status === 'error' || status === 'cancelled';
}

async function loadExecutionStateSnapshot(params: {
    serverNotebookId: string;
    workflow: WorkflowResponse;
    payload: NotebookPayloadDto;
    executionId?: string;
    shouldApplyBlockStatuses: boolean;
}) {
    let latestExecution;

    if (params.executionId) {
        latestExecution = await executionApi.getById(
            params.serverNotebookId,
            params.workflow.id,
            params.executionId,
        );
    } else {
        const executions = await executionApi.getExecutions(
            params.serverNotebookId,
            params.workflow.id,
        );

        latestExecution = executions[0];
    }

    if (!latestExecution) {
        return {
            executionId: null as string | null,
            payload: params.payload,
            logs: [] as NotebookExecutionLog[],
            status: 'idle' as WorkflowExecutionStatus,
            result: null as WorkflowExecutionResult | null,
        };
    }

    const frontendStatus = mapApiExecutionStatus(latestExecution.status);

    const latestLogs = await executionApi.getLogs(
        params.serverNotebookId,
        params.workflow.id,
        latestExecution.id,
    );

    const payloadWithExecutionState = applyExecutionStatusesToPayload({
        payload: params.payload,
        workflow: params.workflow,
        logs: latestLogs,
        shouldApplyBlockStatuses: params.shouldApplyBlockStatuses,
        executionStatus: frontendStatus,
    });

    const notebookLogs = mapExecutionLogsToNotebookLogs({
        payload: payloadWithExecutionState,
        workflow: params.workflow,
        logs: latestLogs,
    });

    return {
        executionId: latestExecution.id,
        payload: payloadWithExecutionState,
        logs: notebookLogs,
        status: frontendStatus,
        result: toWorkflowExecutionResult(latestExecution),
    };
}

async function pollExecutionStateUntilFinished(params: {
    serverNotebookId: string;
    workflow: WorkflowResponse;
    payload: NotebookPayloadDto;
    executionId: string;
    shouldApplyBlockStatuses: boolean;
    isCancelled: () => boolean;
    onStateLoaded: (state: Awaited<ReturnType<typeof loadExecutionStateSnapshot>>) => void;
}) {
    for (let pollIndex = 0; pollIndex < RESTORE_EXECUTION_MAX_POLLS; pollIndex += 1) {
        if (params.isCancelled()) {
            return;
        }

        await sleep(RESTORE_EXECUTION_POLL_INTERVAL_MS);

        if (params.isCancelled()) {
            return;
        }

        const state = await loadExecutionStateSnapshot({
            serverNotebookId: params.serverNotebookId,
            workflow: params.workflow,
            payload: params.payload,
            executionId: params.executionId,
            shouldApplyBlockStatuses: params.shouldApplyBlockStatuses,
        });

        if (params.isCancelled()) {
            return;
        }

        params.onStateLoaded(state);

        if (isRestoredExecutionFinished(state.status)) {
            return;
        }
    }
}

function resetPayloadBlockStatuses(
    payload: NotebookPayloadDto | null,
): NotebookPayloadDto | null {
    if (!payload) {
        return null;
    }

    return {
        ...payload,
        blocks: payload.blocks.map((block) => ({
            ...block,
            status: 'idle',
        })),
    };
}

function mapBackendValidationToIssues(
    validation: WorkflowValidationResponse,
): WorkflowValidationIssue[] {
    return [
        ...validation.errors.map((message, index) => ({
            id: `backend-error-${index}`,
            severity: 'error' as const,
            message: `Backend: ${message}`,
        })),
        ...validation.warnings.map((message, index) => ({
            id: `backend-warning-${index}`,
            severity: 'warning' as const,
            message: `Backend: ${message}`,
        })),
    ];
}

function createValidationLogs(issues: WorkflowValidationIssue[]): NotebookExecutionLog[] {
    if (issues.length === 0) {
        return [
            createExecutionLog({
                level: 'success',
                status: 'success',
                message:
                    'Проверка завершена: frontend и backend не нашли ошибок схемы.',
            }),
        ];
    }

    return issues.slice(0, 15).map((issue) =>
        createExecutionLog({
            level: issue.severity === 'error' ? 'error' : 'warning',
            status: issue.severity === 'error' ? 'error' : 'idle',
            blockId: issue.blockId,
            blockTitle: issue.blockTitle,
            message: issue.message,
        }),
    );
}

function createValidationResult(params: {
    issues: WorkflowValidationIssue[];
    totalBlocks: number;
    startedAt: Date;
    idSuffix: string;
}): WorkflowExecutionResult {
    const blockingIssues = getBlockingValidationIssues(params.issues);
    const warnings = params.issues.filter((issue) => issue.severity === 'warning');

    return {
        id: `${params.startedAt.getTime()}-${params.idSuffix}`,
        status: blockingIssues.length > 0 ? 'error' : 'success',
        startedAt: params.startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 0,
        totalBlocks: params.totalBlocks,
        completedBlocks: blockingIssues.length > 0 ? 0 : params.totalBlocks,
        failedBlocks: blockingIssues.length,
        warningsCount: warnings.length,
        errorsCount: blockingIssues.length,
        summary: getValidationResultSummary(params.issues),
        output:
            blockingIssues.length > 0
                ? getValidationErrorSummary(params.issues) ?? 'Схема содержит ошибки.'
                : warnings.length > 0
                    ? 'Критических ошибок нет. Есть предупреждения, которые стоит проверить.'
                    : 'Frontend и backend-валидация не нашли проблем. Можно запускать workflow.',
        outputFormat: 'text',
        rawOutput: JSON.stringify(params.issues, null, 2),
    };
}

// function getServerNotebookIdOrThrow(payload: NotebookPayloadDto) {
//     if (!payload.serverNotebookId) {
//         throw new Error(
//             'Notebook ещё не синхронизирован с backend: отсутствует serverNotebookId.',
//         );
//     }
//
//     return payload.serverNotebookId;
// }
//
// function getWorkflowIdOrThrow(payload: NotebookPayloadDto) {
//     if (!payload.workflowId) {
//         throw new Error(
//             'Workflow ещё не сохранён на backend: отсутствует workflowId.',
//         );
//     }
//
//     return payload.workflowId;
// }

function applyBackendWorkflowIds(
    payload: NotebookPayloadDto,
    workflow: WorkflowResponse,
): NotebookPayloadDto {
    return {
        ...payload,
        serverNotebookId: workflow.notebookId,
        workflowId: workflow.id,
        workflowStatus: workflow.status,
    };
}

function NotebookEditor({ notebookId }: NotebookEditorProps) {
    const isMobile = useMediaQuery('(max-width: 767px)');
    const isDesktop = useMediaQuery('(min-width: 1024px)');

    const initialNotebookPayload = useMemo(
        () => resetPayloadBlockStatuses(loadNotebookLocally(notebookId)),
        [notebookId],
    );

    const [notebookTitle, setNotebookTitle] = useState(
        initialNotebookPayload?.title ?? 'Название notebook',
    );

    const requestIdRef = useRef(0);
    const runRequestIdRef = useRef(0);
    const autoLayoutRequestIdRef = useRef(0);
    const viewportRequestIdRef = useRef(0);
    const searchRequestIdRef = useRef(0);
    const historyRequestIdRef = useRef(0);
    const backendLoadKeyRef = useRef<string | null>(null);

    const [blockRequest, setBlockRequest] = useState<NotebookBlockRequest | null>(null);
    const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<string[]>([]);
    const [manualRecommendation, setManualRecommendation] =
        useState<NotebookRecommendation | null>(null);
    const [mlRecommendations, setMlRecommendations] = useState<NotebookRecommendation[]>([]);
    const [notebookPayload, setNotebookPayload] = useState<NotebookPayloadDto | null>(null);
    const [loadedNotebookPayload, setLoadedNotebookPayload] =
        useState<NotebookPayloadDto | null>(initialNotebookPayload);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
    const [runRequest, setRunRequest] = useState<WorkflowRunRequest | null>(null);
    const [executionStatus, setExecutionStatus] = useState<WorkflowExecutionStatus>('idle');
    const [currentExecutionTarget, setCurrentExecutionTarget] =
        useState<WorkflowExecutionTarget | null>(null);
    const [isExecutionActionPending, setIsExecutionActionPending] = useState(false);
    const [executionLogs, setExecutionLogs] = useState<NotebookExecutionLog[]>([]);
    const [executionResult, setExecutionResult] =
        useState<WorkflowExecutionResult | null>(null);
    const [isRunPanelOpen, setIsRunPanelOpen] = useState(false);
    const [autoLayoutRequest, setAutoLayoutRequest] =
        useState<NotebookAutoLayoutRequest | null>(null);
    const [isInterfaceHidden, setIsInterfaceHidden] = useState(false);
    const [zoomValue, setZoomValue] = useState<NotebookZoomValue>('100');
    const [viewportRequest, setViewportRequest] =
        useState<NotebookViewportRequest | null>(null);
    const [searchRequest, setSearchRequest] =
        useState<NotebookSearchRequest | null>(null);
    const [searchResult, setSearchResult] =
        useState<NotebookSearchResult | null>(null);
    const [historyRequest, setHistoryRequest] =
        useState<NotebookHistoryRequest | null>(null);
    const [historyState, setHistoryState] = useState<NotebookHistoryState>({
        canUndo: false,
        canRedo: false,
    });
    const [inspectedBlock, setInspectedBlock] =
        useState<NotebookBlockInspectionTarget | null>(null);
    const [workflowStatus, setWorkflowStatus] =
        useState<WorkflowStatus | null>(
            initialNotebookPayload?.workflowStatus ?? null,
        );
    const [, setValidationIssues] = useState<WorkflowValidationIssue[]>([]);

    const localRecommendations = useMemo(
        () =>
            getLocalNotebookRecommendations(
                notebookPayload ?? loadedNotebookPayload,
            ),
        [loadedNotebookPayload, notebookPayload],
    );

    const recommendations = useMemo(() => {
        if (mlRecommendations.length > 0) {
            return mlRecommendations;
        }

        return localRecommendations;
    }, [localRecommendations, mlRecommendations]);

    const visibleSuggestion = useMemo(() => {
        const candidates = manualRecommendation
            ? [manualRecommendation, ...recommendations]
            : recommendations;

        return (
            candidates.find(
                (recommendation) =>
                    !dismissedSuggestionIds.includes(recommendation.id),
            ) ?? null
        );
    }, [dismissedSuggestionIds, manualRecommendation, recommendations]);

    useEffect(() => {
        const currentPayload = notebookPayload ?? loadedNotebookPayload;

        if (!currentPayload) {
            setMlRecommendations([]);
            return;
        }

        let isCancelled = false;
        const abortController = new AbortController();

        const timeoutId = window.setTimeout(() => {
            void (async () => {
                try {
                    const recommendationsFromMl =
                        await mlRecommendationApi.getNextBlockRecommendations({
                            payload: currentPayload,
                            limit: 3,
                            signal: abortController.signal,
                        });

                    if (isCancelled) {
                        return;
                    }

                    setMlRecommendations(recommendationsFromMl);
                } catch (error) {
                    if (isCancelled) {
                        return;
                    }

                    if (
                        error instanceof DOMException &&
                        error.name === 'AbortError'
                    ) {
                        return;
                    }

                    console.warn(
                        'ML recommendations are unavailable, local recommendations will be used:',
                        error,
                    );

                    setMlRecommendations([]);
                }
            })();
        }, ML_RECOMMENDATION_DEBOUNCE_MS);

        return () => {
            isCancelled = true;
            abortController.abort();
            window.clearTimeout(timeoutId);
        };
    }, [loadedNotebookPayload, notebookPayload]);

    useEffect(() => {
        const sourcePayload = loadedNotebookPayload ?? initialNotebookPayload;
        const serverNotebookId = sourcePayload?.serverNotebookId;

        if (!serverNotebookId) {
            return;
        }

        const workflowId = sourcePayload.workflowId;
        const loadKey = `${serverNotebookId}:${workflowId ?? 'first-workflow'}`;

        if (backendLoadKeyRef.current === loadKey) {
            return;
        }

        backendLoadKeyRef.current = loadKey;

        let isCancelled = false;

        const animationFrameId = window.requestAnimationFrame(() => {
            void (async () => {
                try {
                    const backendNotebook = await notebookApi.getNotebook(serverNotebookId);

                    let backendWorkflow;

                    if (workflowId) {
                        backendWorkflow = await workflowApi.getWorkflow(serverNotebookId, workflowId);
                    } else {
                        const workflowSummaries = await workflowApi.getWorkflows(serverNotebookId);
                        const firstWorkflowSummary = workflowSummaries[0];

                        if (!firstWorkflowSummary) {
                            return;
                        }

                        backendWorkflow = await workflowApi.getWorkflow(
                            serverNotebookId,
                            firstWorkflowSummary.id,
                        );
                    }

                    if (!backendWorkflow) {
                        return;
                    }

                    if (isCancelled) {
                        return;
                    }

                    const restoredPayload = fromBackendWorkflowResponse({
                        localNotebookId: notebookId,
                        notebook: backendNotebook,
                        workflow: backendWorkflow,
                        fallbackPayload: sourcePayload,
                    });

                    let payloadWithExecutionState = restoredPayload;

                    try {
                        const shouldApplyBlockStatuses = backendWorkflow.status === 'ACTIVE';

                        const executionState = await loadExecutionStateSnapshot({
                            serverNotebookId,
                            workflow: backendWorkflow,
                            payload: restoredPayload,
                            shouldApplyBlockStatuses,
                        });

                        if (executionState.executionId) {
                            setCurrentExecutionTarget({
                                serverNotebookId,
                                workflowId: backendWorkflow.id,
                                executionId: executionState.executionId,
                            });
                        }

                        payloadWithExecutionState = executionState.payload;

                        setExecutionLogs(executionState.logs);
                        setExecutionStatus(executionState.status);
                        setExecutionResult(executionState.result);
                        setIsRunPanelOpen(false);

                        if (
                            executionState.executionId &&
                            !isRestoredExecutionFinished(executionState.status)
                        ) {
                            void pollExecutionStateUntilFinished({
                                serverNotebookId,
                                workflow: backendWorkflow,
                                payload: restoredPayload,
                                executionId: executionState.executionId,
                                shouldApplyBlockStatuses,
                                isCancelled: () => isCancelled,
                                onStateLoaded: (nextExecutionState) => {
                                    const savedLocalNotebook = saveNotebookLocally(
                                        nextExecutionState.payload,
                                    );

                                    if (nextExecutionState.executionId) {
                                        setCurrentExecutionTarget({
                                            serverNotebookId,
                                            workflowId: backendWorkflow.id,
                                            executionId: nextExecutionState.executionId,
                                        });
                                    }

                                    setLoadedNotebookPayload(savedLocalNotebook);
                                    setNotebookPayload(savedLocalNotebook);
                                    setExecutionLogs(nextExecutionState.logs);
                                    setExecutionStatus(nextExecutionState.status);
                                    setExecutionResult(nextExecutionState.result);
                                },
                            });
                        }
                    } catch (executionHistoryError) {
                        console.warn(
                            'Execution history loading failed, notebook schema was loaded:',
                            executionHistoryError,
                        );
                    }

                    const savedLocalNotebook = saveNotebookLocally(payloadWithExecutionState);

                    setNotebookTitle(savedLocalNotebook.title);
                    setLoadedNotebookPayload(savedLocalNotebook);
                    setNotebookPayload(savedLocalNotebook);
                    setWorkflowStatus(backendWorkflow.status);
                    setSaveError(null);

                    console.log('Notebook loaded from backend:', {
                        serverNotebookId,
                        workflowId: backendWorkflow.id,
                    });
                } catch (error) {
                    if (isCancelled) {
                        return;
                    }

                    console.warn(
                        'Notebook backend loading failed, local copy is used:',
                        error,
                    );
                }
            })();
        });

        return () => {
            isCancelled = true;
            window.cancelAnimationFrame(animationFrameId);
        };
    }, [
        initialNotebookPayload,
        loadedNotebookPayload,
        notebookId,
    ]);

    useEffect(() => {
        if (!saveSuccessMessage) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setSaveSuccessMessage(null);
        }, 4000);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [saveSuccessMessage]);

    useEffect(() => {
        if (!saveError) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setSaveError(null);
        }, 5000);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [saveError]);

    const handleAddBlock = useCallback((blockType: NotebookBlockType) => {
        requestIdRef.current += 1;

        setBlockRequest({
            requestId: requestIdRef.current,
            blockType,
        });
    }, []);

    const handleAddRecommendedBlock = useCallback(
        (recommendation: NotebookRecommendation) => {
            requestIdRef.current += 1;

            setBlockRequest({
                requestId: requestIdRef.current,
                blockType: recommendation.blockType,
                sourceBlockId: recommendation.targetBlockId,
                proposedConfig: recommendation.proposedConfig,
            });
        },
        [],
    );

    const handleBlockRequestHandled = useCallback((requestId: number) => {
        setBlockRequest((currentRequest) =>
            currentRequest?.requestId === requestId ? null : currentRequest,
        );
    }, []);

    const handleAcceptSuggestion = useCallback(
        (recommendation: NotebookRecommendation) => {
            handleAddRecommendedBlock(recommendation);
            setManualRecommendation(null);
        },
        [handleAddRecommendedBlock],
    );

    const handleDismissSuggestion = useCallback((suggestionId: string) => {
        setDismissedSuggestionIds((currentIds) =>
            currentIds.includes(suggestionId)
                ? currentIds
                : [...currentIds, suggestionId],
        );

        setManualRecommendation((currentRecommendation) =>
            currentRecommendation?.id === suggestionId
                ? null
                : currentRecommendation,
        );
    }, []);

    const handleBlockAutocomplete = useCallback(
        (payload: NotebookPayloadDto, blockId: string) => {
            const recommendation = getBlockAutocompleteRecommendation(
                payload,
                blockId,
            );

            if (!recommendation) {
                setExecutionLogs([
                    createExecutionLog({
                        level: 'warning',
                        status: 'idle',
                        blockId,
                        message:
                            'Для этого блока пока нет доступной рекомендации автодополнения.',
                    }),
                ]);

                setExecutionStatus('idle');
                setIsRunPanelOpen(true);
                return;
            }

            setManualRecommendation(recommendation);

            setDismissedSuggestionIds((currentIds) =>
                currentIds.filter((suggestionId) => suggestionId !== recommendation.id),
            );
        },
        [],
    );

    const validateCurrentNotebook = useCallback(() => {
        const payload = notebookPayload ?? loadedNotebookPayload;
        const issues = validateNotebookPayload(payload);

        setValidationIssues(issues);

        return issues;
    }, [loadedNotebookPayload, notebookPayload]);

    const saveNotebookToBackend = useCallback(
        async () => {
            const basePayload = notebookPayload ?? loadedNotebookPayload;

            if (!basePayload) {
                throw new Error('Нет данных notebook для сохранения.');
            }

            const payloadToSave: NotebookPayloadDto = {
                ...basePayload,
                id: notebookId,
                title: notebookTitle,
                serverNotebookId:
                    basePayload.serverNotebookId ?? loadedNotebookPayload?.serverNotebookId,
                workflowId:
                    basePayload.workflowId ?? loadedNotebookPayload?.workflowId,
                updatedAt: new Date().toISOString(),
            };

            try {
                const notebookRequest = {
                    name: payloadToSave.title,
                    description: `FlowAct notebook: ${payloadToSave.title}`,
                };

                let serverNotebookId = payloadToSave.serverNotebookId;

                if (serverNotebookId) {
                    await notebookApi.updateNotebook(serverNotebookId, notebookRequest);
                } else {
                    const createdNotebook = await notebookApi.createNotebook(notebookRequest);
                    serverNotebookId = createdNotebook.id;
                }

                const payloadWithServerNotebookId: NotebookPayloadDto = {
                    ...payloadToSave,
                    serverNotebookId,
                };

                const baseWorkflowPayload = toBackendWorkflowRequest(
                    payloadWithServerNotebookId,
                );

                console.log('Backend workflow contract:', baseWorkflowPayload);

                const storedWorkflowId = payloadWithServerNotebookId.workflowId;

                let savedWorkflow: WorkflowResponse;

                if (storedWorkflowId) {
                    try {
                        savedWorkflow = await workflowApi.updateWorkflow(
                            serverNotebookId,
                            storedWorkflowId,
                            {
                                ...baseWorkflowPayload,
                                notebookId: serverNotebookId,
                                id: storedWorkflowId,
                            },
                        );
                    } catch (error) {
                        if (!(error instanceof ApiError && error.status === 404)) {
                            throw error;
                        }

                        console.warn(
                            'Stored workflowId was not found on backend, a new workflow will be created:',
                            {
                                serverNotebookId,
                                workflowId: storedWorkflowId,
                            },
                        );

                        savedWorkflow = await workflowApi.createWorkflow(
                            serverNotebookId,
                            {
                                ...baseWorkflowPayload,
                                notebookId: serverNotebookId,
                            },
                        );
                    }
                } else {
                    savedWorkflow = await workflowApi.createWorkflow(
                        serverNotebookId,
                        {
                            ...baseWorkflowPayload,
                            notebookId: serverNotebookId,
                        },
                    );
                }

                const savedPayload: NotebookPayloadDto = {
                    ...applyBackendWorkflowIds(
                        payloadWithServerNotebookId,
                        savedWorkflow,
                    ),
                    updatedAt: new Date().toISOString(),
                };

                const savedLocalNotebook = saveNotebookLocally(savedPayload);

                setLoadedNotebookPayload(savedLocalNotebook);
                setNotebookPayload(savedLocalNotebook);
                setWorkflowStatus(savedWorkflow.status);
                setSaveError(null);

                console.log('Notebook and workflow saved via API:', {
                    serverNotebookId: savedWorkflow.notebookId,
                    workflowId: savedWorkflow.id,
                });

                return savedLocalNotebook;
            } catch (error) {
                const message = getBackendSaveErrorMessage(error);

                setSaveError(message);
                console.warn('Notebook backend save failed:', error);

                throw error;
            }
        },
        [
            loadedNotebookPayload,
            notebookId,
            notebookPayload,
            notebookTitle,
        ],
    );

    const refreshExecutionState = useCallback(
        async (target: WorkflowExecutionTarget) => {
            const payload = notebookPayload ?? loadedNotebookPayload;

            if (!payload) {
                throw new Error('Нет локальных данных notebook для обновления выполнения.');
            }

            const workflow = await workflowApi.getWorkflow(
                target.serverNotebookId,
                target.workflowId,
            );

            const executionState = await loadExecutionStateSnapshot({
                serverNotebookId: target.serverNotebookId,
                workflow,
                payload,
                executionId: target.executionId,
                shouldApplyBlockStatuses: true,
            });

            const savedLocalNotebook = saveNotebookLocally(executionState.payload);

            setLoadedNotebookPayload(savedLocalNotebook);
            setNotebookPayload(savedLocalNotebook);
            setExecutionLogs(executionState.logs);
            setExecutionStatus(executionState.status);
            setExecutionResult(executionState.result);

            if (executionState.executionId) {
                setCurrentExecutionTarget({
                    ...target,
                    executionId: executionState.executionId,
                });
            }

            return executionState;
        },
        [loadedNotebookPayload, notebookPayload],
    );

    const handleExecutionStarted = useCallback((target: WorkflowExecutionTarget) => {
        setCurrentExecutionTarget(target);
    }, []);

    const handleCancelExecution = useCallback(async () => {
        if (!currentExecutionTarget) {
            return;
        }

        setIsExecutionActionPending(true);
        setExecutionStatus('cancelling');
        setIsRunPanelOpen(true);

        setExecutionLogs((currentLogs) => [
            ...currentLogs,
            createExecutionLog({
                level: 'warning',
                status: 'cancelling',
                message: 'Отправлен запрос на отмену выполнения.',
            }),
        ]);

        try {
            const cancelledExecution = await executionApi.cancel(
                currentExecutionTarget.serverNotebookId,
                currentExecutionTarget.workflowId,
                currentExecutionTarget.executionId,
            );

            const nextTarget: WorkflowExecutionTarget = {
                ...currentExecutionTarget,
                executionId: cancelledExecution.id,
            };

            setCurrentExecutionTarget(nextTarget);
            await refreshExecutionState(nextTarget);
        } catch (error) {
            setExecutionStatus('error');
            setExecutionLogs((currentLogs) => [
                ...currentLogs,
                createExecutionLog({
                    level: 'error',
                    status: 'error',
                    message:
                        error instanceof Error
                            ? `Не удалось отменить выполнение: ${error.message}`
                            : 'Не удалось отменить выполнение.',
                }),
            ]);
        } finally {
            setIsExecutionActionPending(false);
        }
    }, [currentExecutionTarget, refreshExecutionState]);

    const handleRetryExecution = useCallback(async () => {
        if (!currentExecutionTarget) {
            return;
        }

        setIsExecutionActionPending(true);
        setExecutionStatus('pending');
        setIsRunPanelOpen(true);
        setExecutionResult(null);

        setExecutionLogs([
            createExecutionLog({
                level: 'info',
                status: 'pending',
                message: 'Отправлен запрос на повтор выполнения.',
            }),
        ]);

        try {
            const retriedExecution = await executionApi.retry(
                currentExecutionTarget.serverNotebookId,
                currentExecutionTarget.workflowId,
                currentExecutionTarget.executionId,
            );

            const nextTarget: WorkflowExecutionTarget = {
                ...currentExecutionTarget,
                executionId: retriedExecution.id,
            };

            setCurrentExecutionTarget(nextTarget);
            await refreshExecutionState(nextTarget);
        } catch (error) {
            setExecutionStatus('error');
            setExecutionLogs([
                createExecutionLog({
                    level: 'error',
                    status: 'error',
                    message:
                        error instanceof Error
                            ? `Не удалось повторить выполнение: ${error.message}`
                            : 'Не удалось повторить выполнение.',
                }),
            ]);
        } finally {
            setIsExecutionActionPending(false);
        }
    }, [currentExecutionTarget, refreshExecutionState]);

    const handleResumeExecution = useCallback(async () => {
        if (!currentExecutionTarget) {
            return;
        }

        setIsExecutionActionPending(true);
        setExecutionStatus('running');
        setIsRunPanelOpen(true);

        setExecutionLogs((currentLogs) => [
            ...currentLogs,
            createExecutionLog({
                level: 'info',
                status: 'running',
                message: 'Отправлен запрос на продолжение выполнения.',
            }),
        ]);

        try {
            const resumedExecution = await executionApi.resume(
                currentExecutionTarget.serverNotebookId,
                currentExecutionTarget.workflowId,
                currentExecutionTarget.executionId,
                {
                    resumePayload: {},
                },
            );

            const nextTarget: WorkflowExecutionTarget = {
                ...currentExecutionTarget,
                executionId: resumedExecution.id,
            };

            setCurrentExecutionTarget(nextTarget);
            await refreshExecutionState(nextTarget);
        } catch (error) {
            setExecutionStatus('error');
            setExecutionLogs((currentLogs) => [
                ...currentLogs,
                createExecutionLog({
                    level: 'error',
                    status: 'error',
                    message:
                        error instanceof Error
                            ? `Не удалось продолжить выполнение: ${error.message}`
                            : 'Не удалось продолжить выполнение.',
                }),
            ]);
        } finally {
            setIsExecutionActionPending(false);
        }
    }, [currentExecutionTarget, refreshExecutionState]);

    const handleSaveNotebook = useCallback(async () => {
        setIsSaving(true);
        setSaveError(null);
        setSaveSuccessMessage(null);

        try {
            await saveNotebookToBackend();

            const issues = validateCurrentNotebook();
            const blockingIssues = getBlockingValidationIssues(issues);

            setSaveSuccessMessage(
                blockingIssues.length > 0
                    ? `Workflow сохранён как черновик. Ошибок схемы: ${blockingIssues.length}.`
                    : 'Workflow сохранён.',
            );
        } catch (error) {
            const message = getBackendSaveErrorMessage(error);

            setSaveError(message);
            setSaveSuccessMessage(null);
            console.warn('Strict backend save failed:', error);
        } finally {
            setIsSaving(false);
        }
    }, [saveNotebookToBackend, validateCurrentNotebook]);

    const handleValidateWorkflow = useCallback(async () => {
        const checkedAt = new Date();
        const currentPayload = notebookPayload ?? loadedNotebookPayload;
        const totalBlocks = currentPayload?.blocks.length ?? 0;

        setIsRunPanelOpen(true);
        setExecutionStatus('validating');
        setExecutionResult(null);
        setExecutionLogs([
            createExecutionLog({
                level: 'info',
                status: 'validating',
                message: 'Запущена frontend-проверка схемы.',
            }),
        ]);

        const frontendIssues = validateCurrentNotebook();
        const frontendBlockingIssues = getBlockingValidationIssues(frontendIssues);

        if (frontendBlockingIssues.length > 0) {
            setExecutionStatus('error');
            setExecutionLogs(createValidationLogs(frontendIssues));
            setExecutionResult(
                createValidationResult({
                    issues: frontendIssues,
                    totalBlocks,
                    startedAt: checkedAt,
                    idSuffix: 'frontend-validation-result',
                }),
            );

            setSaveError(
                `Frontend-валидация нашла ошибок: ${frontendBlockingIssues.length}.`,
            );

            return;
        }

        setExecutionLogs([
            createExecutionLog({
                level: 'success',
                status: 'success',
                message:
                    'Frontend-проверка завершена успешно. Сохранение workflow для backend-валидации.',
            }),
        ]);

        setIsSaving(true);

        try {
            const savedPayload = await saveNotebookToBackend();

            if (!savedPayload.serverNotebookId || !savedPayload.workflowId) {
                throw new Error('Workflow не имеет serverNotebookId или workflowId.');
            }

            setExecutionStatus('validating');
            setExecutionLogs([
                createExecutionLog({
                    level: 'success',
                    status: 'success',
                    message: 'Frontend-проверка завершена успешно.',
                }),
                createExecutionLog({
                    level: 'info',
                    status: 'validating',
                    message: 'Запущена backend-проверка схемы.',
                }),
            ]);

            const backendValidation = await workflowApi.validateWorkflow(
                savedPayload.serverNotebookId,
                savedPayload.workflowId,
            );

            const backendIssues = mapBackendValidationToIssues(backendValidation);
            const allIssues = [...frontendIssues, ...backendIssues];
            const blockingIssues = getBlockingValidationIssues(allIssues);

            setValidationIssues(allIssues);
            setExecutionStatus(blockingIssues.length > 0 ? 'error' : 'success');
            setExecutionLogs([
                createExecutionLog({
                    level: 'success',
                    status: 'success',
                    message: 'Frontend-проверка завершена успешно.',
                }),
                ...createValidationLogs(backendIssues),
            ]);
            setExecutionResult(
                createValidationResult({
                    issues: allIssues,
                    totalBlocks: savedPayload.blocks.length,
                    startedAt: checkedAt,
                    idSuffix: 'full-validation-result',
                }),
            );

            if (blockingIssues.length > 0) {
                setSaveError(
                    `Backend-валидация нашла ошибок: ${blockingIssues.length}.`,
                );
                return;
            }

            setSaveError(null);
            setSaveSuccessMessage(
                backendValidation.warnings.length > 0
                    ? `Проверка завершена. Предупреждений: ${backendValidation.warnings.length}.`
                    : 'Проверка завершена: схема готова к запуску.',
            );
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Не удалось выполнить backend-валидацию.';

            setExecutionStatus('error');
            setExecutionLogs([
                createExecutionLog({
                    level: 'error',
                    status: 'error',
                    message: `Backend-проверка не выполнена: ${message}`,
                }),
            ]);
            setExecutionResult({
                id: `${checkedAt.getTime()}-backend-validation-error`,
                status: 'error',
                startedAt: checkedAt.toISOString(),
                finishedAt: new Date().toISOString(),
                durationMs: 0,
                totalBlocks,
                completedBlocks: 0,
                failedBlocks: 1,
                warningsCount: 0,
                errorsCount: 1,
                summary: 'Backend-проверка не выполнена',
                output:
                    'Не удалось сохранить workflow или получить результат backend-валидации.',
                outputFormat: 'text',
                rawOutput: JSON.stringify(
                    {
                        message,
                        error,
                    },
                    null,
                    2,
                ),
            });

            setSaveError(`Backend-проверка не выполнена: ${message}`);
            console.warn('Backend workflow validation failed:', error);
        } finally {
            setIsSaving(false);
        }
    }, [
        loadedNotebookPayload,
        notebookPayload,
        saveNotebookToBackend,
        validateCurrentNotebook,
    ]);

    const handleRunWorkflow = useCallback(async () => {
        runRequestIdRef.current += 1;
        const requestId = runRequestIdRef.current;

        setExecutionResult(null);
        setIsRunPanelOpen(true);
        setExecutionStatus('pending');
        setCurrentExecutionTarget(null);
        setExecutionLogs([
            createExecutionLog({
                level: 'info',
                status: 'pending',
                message: 'Сохранение workflow перед запуском.',
            }),
        ]);

        setIsSaving(true);
        setSaveError(null);

        try {
            const validationIssues = validateCurrentNotebook();
            const blockingIssues = getBlockingValidationIssues(validationIssues);

            if (blockingIssues.length > 0) {
                const finishedAt = new Date();

                setExecutionStatus('error');
                setIsRunPanelOpen(true);

                setExecutionLogs(
                    blockingIssues.slice(0, 5).map((issue) =>
                        createExecutionLog({
                            level: issue.severity === 'error' ? 'error' : 'warning',
                            status: 'error',
                            blockId: issue.blockId,
                            blockTitle: issue.blockTitle,
                            message: issue.message,
                        }),
                    ),
                );

                setExecutionResult({
                    id: `${finishedAt.getTime()}-frontend-validation-error`,
                    status: 'error',
                    startedAt: finishedAt.toISOString(),
                    finishedAt: finishedAt.toISOString(),
                    durationMs: 0,
                    totalBlocks: 0,
                    completedBlocks: 0,
                    failedBlocks: blockingIssues.length,
                    warningsCount: validationIssues.filter(
                        (issue) => issue.severity === 'warning',
                    ).length,
                    errorsCount: blockingIssues.length,
                    summary: 'Схема не готова к запуску',
                    output:
                        getValidationErrorSummary(validationIssues) ??
                        'Схема содержит ошибки.',
                    outputFormat: 'text',
                    rawOutput: JSON.stringify(validationIssues, null, 2),
                });

                setSaveError(
                    `Схема не готова к запуску: найдено ошибок ${blockingIssues.length}. Подробности показаны в панели выполнения.`,
                );

                return;
            }

            setValidationIssues([]);

            const savedPayload = await saveNotebookToBackend();

            if (!savedPayload.serverNotebookId || !savedPayload.workflowId) {
                throw new Error('Workflow не имеет serverNotebookId или workflowId.');
            }

            setExecutionLogs([
                createExecutionLog({
                    level: 'success',
                    status: 'success',
                    message: 'Workflow сохранён перед запуском.',
                }),
                createExecutionLog({
                    level: 'info',
                    status: 'validating',
                    message: 'Запущена backend-проверка схемы.',
                }),
            ]);

            const backendValidation = await workflowApi.validateWorkflow(
                savedPayload.serverNotebookId,
                savedPayload.workflowId,
            );

            const backendIssues = mapBackendValidationToIssues(backendValidation);
            const backendBlockingIssues = getBlockingValidationIssues(backendIssues);

            if (backendBlockingIssues.length > 0 || !backendValidation.valid) {
                const finishedAt = new Date();

                setValidationIssues([...validationIssues, ...backendIssues]);
                setExecutionStatus('error');
                setExecutionLogs(createValidationLogs(backendIssues));
                setExecutionResult(
                    createValidationResult({
                        issues: [...validationIssues, ...backendIssues],
                        totalBlocks: savedPayload.blocks.length,
                        startedAt: finishedAt,
                        idSuffix: 'backend-validation-error',
                    }),
                );

                setSaveError(
                    `Backend-валидация нашла ошибок: ${backendBlockingIssues.length}.`,
                );

                return;
            }

            setExecutionLogs([
                createExecutionLog({
                    level: 'success',
                    status: 'success',
                    message: 'Backend-проверка завершена успешно.',
                }),
                createExecutionLog({
                    level: 'info',
                    status: 'pending',
                    message: 'Активация workflow перед запуском.',
                }),
            ]);

            const activatedWorkflow = await workflowApi.activateWorkflow(
                savedPayload.serverNotebookId,
                savedPayload.workflowId,
            );

            setWorkflowStatus(activatedWorkflow.status);

            const activatedPayload = applyBackendWorkflowIds(
                {
                    ...savedPayload,
                    updatedAt: new Date().toISOString(),
                },
                activatedWorkflow,
            );

            const savedLocalNotebook = saveNotebookLocally(activatedPayload);

            setLoadedNotebookPayload(savedLocalNotebook);
            setNotebookPayload(savedLocalNotebook);

            setExecutionStatus('pending');
            setExecutionLogs([
                createExecutionLog({
                    level: 'success',
                    status: 'success',
                    message: 'Workflow активирован.',
                }),
                createExecutionLog({
                    level: 'info',
                    status: 'pending',
                    message: 'Отправлен backend-запрос на запуск workflow.',
                }),
            ]);

            const startedExecution = await executionApi.run(
                activatedWorkflow.notebookId,
                activatedWorkflow.id,
                {
                    inputData: {},
                },
            );

            const target: WorkflowExecutionTarget = {
                serverNotebookId: activatedWorkflow.notebookId,
                workflowId: activatedWorkflow.id,
                executionId: startedExecution.id,
            };

            setCurrentExecutionTarget(target);

            const initialExecutionStatus = mapApiExecutionStatus(startedExecution.status);
            setExecutionStatus(initialExecutionStatus);

            const executionState = await loadExecutionStateSnapshot({
                serverNotebookId: activatedWorkflow.notebookId,
                workflow: activatedWorkflow,
                payload: savedLocalNotebook,
                executionId: startedExecution.id,
                shouldApplyBlockStatuses: true,
            });

            const payloadWithExecutionState = saveNotebookLocally(executionState.payload);

            setLoadedNotebookPayload(payloadWithExecutionState);
            setNotebookPayload(payloadWithExecutionState);
            setExecutionLogs(executionState.logs);
            setExecutionStatus(executionState.status);
            setExecutionResult(executionState.result);

            if (!isRestoredExecutionFinished(executionState.status)) {
                void pollExecutionStateUntilFinished({
                    serverNotebookId: activatedWorkflow.notebookId,
                    workflow: activatedWorkflow,
                    payload: payloadWithExecutionState,
                    executionId: startedExecution.id,
                    shouldApplyBlockStatuses: true,
                    isCancelled: () => runRequestIdRef.current !== requestId,
                    onStateLoaded: (nextExecutionState) => {
                        const nextPayloadWithExecutionState = saveNotebookLocally(
                            nextExecutionState.payload,
                        );

                        if (nextExecutionState.executionId) {
                            setCurrentExecutionTarget({
                                serverNotebookId: activatedWorkflow.notebookId,
                                workflowId: activatedWorkflow.id,
                                executionId: nextExecutionState.executionId,
                            });
                        }

                        setLoadedNotebookPayload(nextPayloadWithExecutionState);
                        setNotebookPayload(nextPayloadWithExecutionState);
                        setExecutionLogs(nextExecutionState.logs);
                        setExecutionStatus(nextExecutionState.status);
                        setExecutionResult(nextExecutionState.result);
                    },
                });
            }
        } catch (error) {
            const finishedAt = new Date();

            setExecutionStatus('error');
            setExecutionLogs([
                createExecutionLog({
                    level: 'error',
                    status: 'error',
                    message:
                        error instanceof Error
                            ? `Не удалось запустить workflow: ${error.message}`
                            : 'Не удалось запустить workflow.',
                }),
            ]);
            setExecutionResult({
                id: `${finishedAt.getTime()}-backend-run-error`,
                status: 'error',
                startedAt: finishedAt.toISOString(),
                finishedAt: finishedAt.toISOString(),
                durationMs: 0,
                totalBlocks: 0,
                completedBlocks: 0,
                failedBlocks: 1,
                warningsCount: 0,
                errorsCount: 1,
                summary: 'Рабочий процесс не был запущен',
                output: 'Не удалось сохранить workflow или отправить запрос на запуск.',
            });

            console.warn('Workflow backend run failed:', error);
        } finally {
            setIsSaving(false);
        }
    }, [saveNotebookToBackend, validateCurrentNotebook]);

    const handleRunRequestHandled = useCallback((requestId: number) => {
        setRunRequest((currentRequest) =>
            currentRequest?.requestId === requestId ? null : currentRequest,
        );
    }, []);

    const handleOpenRunPanel = useCallback(() => {
        setIsRunPanelOpen(true);
    }, []);

    const handleCloseRunPanel = useCallback(() => {
        setIsRunPanelOpen(false);
    }, []);

    const handleClearExecutionLogs = useCallback(() => {
        setExecutionLogs([]);
        setExecutionResult(null);
        setExecutionStatus('idle');
        setCurrentExecutionTarget(null);
    }, []);

    const handleAutoLayout = useCallback((mode: NotebookAutoLayoutMode = 'arrange-connect') => {
        autoLayoutRequestIdRef.current += 1;

        setIsRunPanelOpen(true);
        setAutoLayoutRequest({
            requestId: autoLayoutRequestIdRef.current,
            mode,
        });
    }, []);

    const handleAutoLayoutRequestHandled = useCallback((requestId: number) => {
        setAutoLayoutRequest((currentRequest) =>
            currentRequest?.requestId === requestId ? null : currentRequest,
        );
    }, []);

    const handleZoomChange = useCallback((nextZoomValue: NotebookZoomValue) => {
        viewportRequestIdRef.current += 1;

        setZoomValue(nextZoomValue);

        if (nextZoomValue === 'auto') {
            setViewportRequest({
                requestId: viewportRequestIdRef.current,
                mode: 'fit',
            });

            return;
        }

        setViewportRequest({
            requestId: viewportRequestIdRef.current,
            mode: 'zoom',
            zoom: Number(nextZoomValue) / 100,
        });
    }, []);

    const handleViewportRequestHandled = useCallback((requestId: number) => {
        setViewportRequest((currentRequest) =>
            currentRequest?.requestId === requestId ? null : currentRequest,
        );
    }, []);

    const handleRenameNotebook = useCallback(
        (nextTitle: string) => {
            const normalizedTitle = nextTitle.trim() || 'Без названия';

            setNotebookTitle(normalizedTitle);

            const basePayload = notebookPayload ?? loadedNotebookPayload;

            if (!basePayload) {
                return;
            }

            const renamedNotebook: NotebookPayloadDto = {
                ...basePayload,
                id: notebookId,
                title: normalizedTitle,
                updatedAt: new Date().toISOString(),
            };

            const savedLocalNotebook = saveNotebookLocally(renamedNotebook);

            setLoadedNotebookPayload(savedLocalNotebook);
            setNotebookPayload(savedLocalNotebook);
            setSaveError(null);
        },
        [loadedNotebookPayload, notebookId, notebookPayload],
    );

    const handleToggleInterface = useCallback(() => {
        setIsInterfaceHidden((currentValue) => !currentValue);
    }, []);

    const handleSearchBlocks = useCallback((query: string) => {
        searchRequestIdRef.current += 1;

        setSearchResult(null);
        setSearchRequest({
            requestId: searchRequestIdRef.current,
            query,
        });
    }, []);

    const handleSearchRequestHandled = useCallback((result: NotebookSearchResult) => {
        setSearchResult(result);
        setSearchRequest((currentRequest) =>
            currentRequest?.requestId === result.requestId ? null : currentRequest,
        );
    }, []);

    const handleUndo = useCallback(() => {
        historyRequestIdRef.current += 1;

        setHistoryRequest({
            requestId: historyRequestIdRef.current,
            action: 'undo',
        });
    }, []);

    const handleRedo = useCallback(() => {
        historyRequestIdRef.current += 1;

        setHistoryRequest({
            requestId: historyRequestIdRef.current,
            action: 'redo',
        });
    }, []);

    const handleHistoryRequestHandled = useCallback((requestId: number) => {
        setHistoryRequest((currentRequest) =>
            currentRequest?.requestId === requestId ? null : currentRequest,
        );
    }, []);

    const handleNotebookChange = useCallback((payload: NotebookPayloadDto) => {
        const loadedFingerprint = getPayloadFingerprint(loadedNotebookPayload);
        const nextFingerprint = getPayloadFingerprint(payload);

        const hasRealChanges =
            Boolean(loadedNotebookPayload) &&
            loadedFingerprint !== nextFingerprint;

        const previousStatus =
            loadedNotebookPayload?.workflowStatus ??
            workflowStatus ??
            payload.workflowStatus ??
            null;

        const nextWorkflowStatus: WorkflowStatus | null =
            previousStatus === 'ARCHIVED'
                ? 'ARCHIVED'
                : hasRealChanges
                    ? 'DRAFT'
                    : previousStatus;

        const nextPayload: NotebookPayloadDto = {
            ...payload,
            serverNotebookId:
                payload.serverNotebookId ?? loadedNotebookPayload?.serverNotebookId,
            workflowId:
                payload.workflowId ?? loadedNotebookPayload?.workflowId,
            workflowStatus: nextWorkflowStatus ?? undefined,
        };

        setNotebookPayload(nextPayload);
        setWorkflowStatus(nextWorkflowStatus);
    }, [loadedNotebookPayload, workflowStatus]);

    return (
        <main
            className={
                isInterfaceHidden
                    ? 'notebook-editor notebook-editor--focus'
                    : 'notebook-editor'
            }
        >
            <NotebookHeader
                isMobile={isMobile}
                title={notebookTitle}
                updatedAt={notebookPayload?.updatedAt ?? loadedNotebookPayload?.updatedAt}
                onRename={handleRenameNotebook}
                onSave={handleSaveNotebook}
                isSaving={isSaving}
                isInterfaceHidden={isInterfaceHidden}
                workflowStatus={workflowStatus}
                onToggleInterface={handleToggleInterface}
                zoomValue={zoomValue}
                onZoomChange={handleZoomChange}
            />

            <div className="notebook-editor__body">
                {isDesktop && !isInterfaceHidden && (
                    <NotebookToolbar
                        onAddBlock={handleAddBlock}
                        onRunWorkflow={handleRunWorkflow}
                        onOpenRunPanel={handleOpenRunPanel}
                        onAutoLayout={handleAutoLayout}
                        onValidateWorkflow={handleValidateWorkflow}
                        isWorkflowRunning={executionStatus === 'running'}
                    />
                )}

                <section className="notebook-editor__workspace">
                    {!isInterfaceHidden && (
                        <NotebookSearch
                            result={searchResult}
                            onSearch={handleSearchBlocks}
                            onUndo={handleUndo}
                            onRedo={handleRedo}
                            canUndo={historyState.canUndo}
                            canRedo={historyState.canRedo}
                        />
                    )}

                    <NotebookCanvas
                        readonly={isMobile}
                        blockRequest={blockRequest}
                        onBlockRequestHandled={handleBlockRequestHandled}
                        notebookId={notebookId}
                        notebookTitle={notebookTitle}
                        initialPayload={loadedNotebookPayload}
                        onNotebookChange={handleNotebookChange}
                        runRequest={runRequest}
                        onExecutionStarted={handleExecutionStarted}
                        onRunRequestHandled={handleRunRequestHandled}
                        onExecutionStatusChange={setExecutionStatus}
                        onExecutionLogsChange={setExecutionLogs}
                        onExecutionResultChange={setExecutionResult}
                        autoLayoutRequest={autoLayoutRequest}
                        onAutoLayoutRequestHandled={handleAutoLayoutRequestHandled}
                        viewportRequest={viewportRequest}
                        onViewportRequestHandled={handleViewportRequestHandled}
                        searchRequest={searchRequest}
                        onSearchRequestHandled={handleSearchRequestHandled}
                        historyRequest={historyRequest}
                        onHistoryRequestHandled={handleHistoryRequestHandled}
                        onHistoryStateChange={setHistoryState}
                        onBlockInspect={setInspectedBlock}
                        onBlockAutocomplete={handleBlockAutocomplete}
                    />

                    {!isInterfaceHidden && (
                        <NotebookRunPanel
                            isOpen={isRunPanelOpen}
                            status={executionStatus}
                            logs={executionLogs}
                            result={executionResult}
                            isMobile={isMobile}
                            onClose={handleCloseRunPanel}
                            onClear={handleClearExecutionLogs}
                            onRunWorkflow={handleRunWorkflow}
                            canCancel={
                                Boolean(currentExecutionTarget) &&
                                ['created', 'validating', 'pending', 'ready', 'running', 'waiting'].includes(executionStatus)
                            }
                            canRetry={
                                Boolean(currentExecutionTarget) &&
                                ['success', 'error', 'cancelled'].includes(executionStatus)
                            }
                            canResume={
                                Boolean(currentExecutionTarget) &&
                                executionStatus === 'waiting'
                            }
                            isExecutionActionPending={isExecutionActionPending}
                            onCancelExecution={handleCancelExecution}
                            onRetryExecution={handleRetryExecution}
                            onResumeExecution={handleResumeExecution}
                        />
                    )}

                    <NotebookBlockInspector
                        block={inspectedBlock}
                        logs={executionLogs}
                        isMobile={isMobile}
                        onClose={() => setInspectedBlock(null)}
                    />

                    {!isInterfaceHidden && (
                        <NotebookSuggestion
                            isMobile={isMobile}
                            suggestion={visibleSuggestion}
                            onAccept={handleAcceptSuggestion}
                            onDismiss={handleDismissSuggestion}
                        />
                    )}

                    {saveError && !isInterfaceHidden && (
                        <div className="notebook-editor__save-message">
                            {saveError}
                        </div>
                    )}

                    {saveSuccessMessage && !saveError && !isInterfaceHidden && (
                        <div className="notebook-editor__save-message notebook-editor__save-message--success">
                            {saveSuccessMessage}
                        </div>
                    )}

                    {isMobile && !isInterfaceHidden && (
                        <NotebookMobileActions
                            onRunWorkflow={handleRunWorkflow}
                            onOpenRunPanel={handleOpenRunPanel}
                            onValidateWorkflow={handleValidateWorkflow}
                            isWorkflowRunning={executionStatus === 'running'}
                        />
                    )}
                </section>
            </div>
        </main>
    );
}

export default NotebookEditor;

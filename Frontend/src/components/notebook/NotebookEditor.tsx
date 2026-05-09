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
    WorkflowRunRequest,
} from './executionTypes';
import {
    fromBackendWorkflowResponse,
    toBackendWorkflowRequest,
} from './backendWorkflowMapper';
import { workflowApi } from '../../services/workflowApi';
import { createExecutionLog } from './workflowExecution';
import { ApiError } from '../../services/apiClient';
import type {
    ExecutionLogResponse,
    WorkflowResponse,
    WorkflowStatus,
} from '../../services/workflowApiTypes';
import {
    validateNotebookPayload,
    type WorkflowValidationIssue,
} from './workflowValidation';
import { executionApi } from '../../services/executionApi';
import {
    toNotebookExecutionLog,
    toWorkflowExecutionResult,
} from './executionApiMapper';
import {
    mapApiExecutionLogStatus,
    mapApiExecutionStatus,
} from './executionTypes';

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

function applyExecutionStatusesToPayload(params: {
    payload: NotebookPayloadDto;
    workflow: WorkflowResponse;
    logs: ExecutionLogResponse[];
    shouldApplyBlockStatuses: boolean;
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

    return {
        ...params.payload,
        blocks: params.payload.blocks.map((block) => ({
            ...block,
            status: blockStatusByFrontendId.get(block.id) ?? block.status ?? 'idle',
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

function NotebookEditor({ notebookId }: NotebookEditorProps) {
    const isMobile = useMediaQuery('(max-width: 767px)');
    const isDesktop = useMediaQuery('(min-width: 1024px)');

    const initialNotebookPayload = useMemo(
        () => loadNotebookLocally(notebookId),
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
    const [notebookPayload, setNotebookPayload] = useState<NotebookPayloadDto | null>(null);
    const [loadedNotebookPayload, setLoadedNotebookPayload] =
        useState<NotebookPayloadDto | null>(initialNotebookPayload);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
    const [runRequest, setRunRequest] = useState<WorkflowRunRequest | null>(null);
    const [executionStatus, setExecutionStatus] = useState<WorkflowExecutionStatus>('idle');
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

    const suggestion = useMemo(
        () => ({
            id: 'suggest-log-after-workflow',
            blockType: 'log' as NotebookBlockType,
            confidence: 87,
            reason:
                'После выполнения рабочих процессов обычно полезно добавить логирование, чтобы сохранять историю запусков и быстрее находить ошибки.',
        }),
        [],
    );

    const visibleSuggestion = dismissedSuggestionIds.includes(suggestion.id)
        ? null
        : suggestion;

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
                        const executions = await executionApi.getExecutions(
                            serverNotebookId,
                            backendWorkflow.id,
                        );

                        const latestExecution = executions[0];

                        if (latestExecution) {
                            const latestLogs = await executionApi.getLogs(
                                serverNotebookId,
                                backendWorkflow.id,
                                latestExecution.id,
                            );

                            const shouldApplyBlockStatuses = backendWorkflow.status === 'ACTIVE';

                            payloadWithExecutionState = applyExecutionStatusesToPayload({
                                payload: restoredPayload,
                                workflow: backendWorkflow,
                                logs: latestLogs,
                                shouldApplyBlockStatuses,
                            });

                            const notebookLogs = mapExecutionLogsToNotebookLogs({
                                payload: payloadWithExecutionState,
                                workflow: backendWorkflow,
                                logs: latestLogs,
                            });

                            setExecutionLogs(notebookLogs);
                            setExecutionStatus(mapApiExecutionStatus(latestExecution.status));
                            setExecutionResult(toWorkflowExecutionResult(latestExecution));

                            if (notebookLogs.length > 0) {
                                setIsRunPanelOpen(false);
                            }
                        } else {
                            setExecutionLogs([]);
                            setExecutionStatus('idle');
                            setExecutionResult(null);
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

    const handleBlockRequestHandled = useCallback((requestId: number) => {
        setBlockRequest((currentRequest) =>
            currentRequest?.requestId === requestId ? null : currentRequest,
        );
    }, []);

    const handleAcceptSuggestion = useCallback(
        (blockType: NotebookBlockType) => {
            handleAddBlock(blockType);
        },
        [handleAddBlock],
    );

    const handleDismissSuggestion = useCallback((suggestionId: string) => {
        setDismissedSuggestionIds((currentIds) =>
            currentIds.includes(suggestionId)
                ? currentIds
                : [...currentIds, suggestionId],
        );
    }, []);

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

                const backendWorkflowPayload = toBackendWorkflowRequest(
                    payloadWithServerNotebookId,
                );

                console.log('Backend workflow contract:', backendWorkflowPayload);

                let workflowId = payloadWithServerNotebookId.workflowId;
                let nextWorkflowStatus: WorkflowStatus | undefined =
                    payloadWithServerNotebookId.workflowStatus;

                if (workflowId) {
                    const updatedWorkflow = await workflowApi.updateWorkflow(
                        serverNotebookId,
                        workflowId,
                        backendWorkflowPayload,
                    );

                    workflowId = updatedWorkflow.id;
                    nextWorkflowStatus = updatedWorkflow.status;
                } else {
                    const createdWorkflow = await workflowApi.createWorkflow(
                        serverNotebookId,
                        backendWorkflowPayload,
                    );

                    workflowId = createdWorkflow.id;
                    nextWorkflowStatus = createdWorkflow.status;
                }

                const savedPayload: NotebookPayloadDto = {
                    ...payloadWithServerNotebookId,
                    workflowId,
                    workflowStatus: nextWorkflowStatus,
                    updatedAt: new Date().toISOString(),
                };

                const savedLocalNotebook = saveNotebookLocally(savedPayload);

                setLoadedNotebookPayload(savedLocalNotebook);
                setNotebookPayload(savedLocalNotebook);
                setWorkflowStatus(nextWorkflowStatus ?? null);
                setSaveError(null);

                console.log('Notebook and workflow saved via API:', {
                    serverNotebookId,
                    workflowId,
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

    const handleRunWorkflow = useCallback(async () => {
        runRequestIdRef.current += 1;
        const requestId = runRequestIdRef.current;

        setExecutionResult(null);
        setIsRunPanelOpen(true);
        setExecutionStatus('pending');
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

            if (!savedPayload?.serverNotebookId || !savedPayload.workflowId) {
                throw new Error('Workflow не имеет serverNotebookId или workflowId.');
            }

            const activatedWorkflow = await workflowApi.activateWorkflow(
                savedPayload.serverNotebookId,
                savedPayload.workflowId,
            );

            setWorkflowStatus(activatedWorkflow.status);

            const activatedPayload: NotebookPayloadDto = {
                ...savedPayload,
                workflowStatus: activatedWorkflow.status,
                updatedAt: new Date().toISOString(),
            };

            const savedLocalNotebook = saveNotebookLocally(activatedPayload);

            setLoadedNotebookPayload(savedLocalNotebook);
            setNotebookPayload(savedLocalNotebook);

            setRunRequest({
                requestId,
                serverNotebookId: activatedPayload.serverNotebookId!,
                workflowId: activatedPayload.workflowId!,
                inputData: {},
            });
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
        setInspectedBlock(null);
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
                        onAutoLayout={() => handleAutoLayout('arrange-connect')}
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
                        readonly={!isDesktop}
                        blockRequest={blockRequest}
                        onBlockRequestHandled={handleBlockRequestHandled}
                        notebookId={notebookId}
                        notebookTitle={notebookTitle}
                        initialPayload={loadedNotebookPayload}
                        onNotebookChange={handleNotebookChange}
                        runRequest={runRequest}
                        onRunRequestHandled={handleRunRequestHandled}
                        onExecutionStatusChange={setExecutionStatus}
                        onExecutionLogsChange={setExecutionLogs}
                        onExecutionResultChange={setExecutionResult}
                        onBlockInspect={setInspectedBlock}
                        autoLayoutRequest={autoLayoutRequest}
                        onAutoLayoutRequestHandled={handleAutoLayoutRequestHandled}
                        viewportRequest={viewportRequest}
                        onViewportRequestHandled={handleViewportRequestHandled}
                        searchRequest={searchRequest}
                        onSearchRequestHandled={handleSearchRequestHandled}
                        historyRequest={historyRequest}
                        onHistoryRequestHandled={handleHistoryRequestHandled}
                        onHistoryStateChange={setHistoryState}
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
                            isWorkflowRunning={executionStatus === 'running'}
                        />
                    )}
                </section>
            </div>
        </main>
    );
}

export default NotebookEditor;

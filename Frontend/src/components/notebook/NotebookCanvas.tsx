import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    addEdge,
    useEdgesState,
    useNodesState,
    type Connection,
    type Edge,
    type NodeTypes,
    type ReactFlowInstance,
    type Viewport,
    type XYPosition,
} from '@xyflow/react';

import AiBlockModal from './AiBlockModal';
import AiBlockNode from './AiBlockNode';
import CustomBlockNode from './CustomBlockNode';
import BlockSettingsModal, { type BlockSettingsPayload } from './BlockSettingsModal';
import EdgeSettingsModal from './EdgeSettingsModal';
import { getBlockDefinition } from './blockLibrary';
import type {
    AiBlockConfig,
    NotebookAutoLayoutRequest,
    NotebookBlockRequest,
    NotebookNode,
} from './notebookTypes';
import type {
    NotebookExecutionLog,
    WorkflowExecutionResult,
    WorkflowExecutionStatus,
    WorkflowRunRequest,
} from './executionTypes';
import type { NotebookPayloadDto } from './notebookBackendTypes';
import { fromNotebookPayload, toNotebookPayload } from './notebookMapper';
import { validateWorkflow } from './workflowValidation';
import { autoLayoutWorkflow } from './workflowAutoLayout';
import {
    defaultAiConfig,
    initialEdges,
    initialNodes,
} from './demoNotebookData';
import {
    conditionBranchLabels,
    getAvailableConditionBranchForEdges,
} from './conditionBranchUtils';
import {
    createExecutionLog,
    getWorkflowExecutionOrder,
    sleep,
} from './workflowExecution';

import '@xyflow/react/dist/style.css';
import './NotebookCanvas.css';

type NotebookCanvasProps = {
    readonly?: boolean;
    blockRequest?: NotebookBlockRequest | null;
    onBlockRequestHandled?: (requestId: number) => void;
    notebookId?: string;
    notebookTitle?: string;
    initialPayload?: NotebookPayloadDto | null;
    onNotebookChange?: (payload: NotebookPayloadDto) => void;
    runRequest?: WorkflowRunRequest | null;
    onRunRequestHandled?: (requestId: number) => void;
    onExecutionStatusChange?: (status: WorkflowExecutionStatus) => void;
    onExecutionLogsChange?: (logs: NotebookExecutionLog[]) => void;
    onExecutionResultChange?: (result: WorkflowExecutionResult | null) => void;
    autoLayoutRequest?: NotebookAutoLayoutRequest | null;
    onAutoLayoutRequestHandled?: (requestId: number) => void;
};

function NotebookCanvas({
                            readonly = false,
                            blockRequest = null,
                            onBlockRequestHandled,
                            notebookId,
                            notebookTitle = 'Название notebook',
                            initialPayload = null,
                            onNotebookChange,
                            runRequest = null,
                            onRunRequestHandled,
                            onExecutionStatusChange,
                            onExecutionLogsChange,
                            onExecutionResultChange,
                            autoLayoutRequest = null,
                            onAutoLayoutRequestHandled,
                        }: NotebookCanvasProps) {
    const canvasRef = useRef<HTMLDivElement | null>(null);
    const nodeCounterRef = useRef(initialNodes.length);
    const loadedPayloadKeyRef = useRef<string | null>(null);
    const isWorkflowRunningRef = useRef(false);

    const [reactFlowInstance, setReactFlowInstance] =
        useState<ReactFlowInstance<NotebookNode, Edge> | null>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState<NotebookNode>(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [viewport, setViewport] = useState<Viewport | undefined>(undefined);
    const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);

    const nodeTypes = useMemo<NodeTypes>(
        () => ({
            aiBlock: AiBlockNode,
            customBlock: CustomBlockNode,
        }),
        [],
    );

    const editingNode = nodes.find((node) => node.id === editingNodeId);
    const editingConfig = editingNode?.data.aiConfig ?? defaultAiConfig;
    const editingEdge = edges.find((edge) => edge.id === editingEdgeId);

    const createNodeId = useCallback((prefix: string) => {
        nodeCounterRef.current += 1;
        return `${prefix}-${nodeCounterRef.current}`;
    }, []);

    const getCanvasCenterPosition = useCallback((): XYPosition => {
        const rect = canvasRef.current?.getBoundingClientRect();

        if (!rect || !reactFlowInstance) {
            return {
                x: 120,
                y: 120,
            };
        }

        const offset = (nodeCounterRef.current % 6) * 24;

        return reactFlowInstance.screenToFlowPosition({
            x: rect.left + rect.width / 2 + offset,
            y: rect.top + rect.height / 2 + offset,
        });
    }, [reactFlowInstance]);

    const createNodeFromRequest = useCallback(
        (request: NotebookBlockRequest): NotebookNode => {
            const definition = getBlockDefinition(request.blockType);
            const position = getCanvasCenterPosition();
            const id = createNodeId(definition.blockType);

            if (definition.blockType === 'ai') {
                return {
                    id,
                    type: 'aiBlock',
                    position,
                    data: {
                        title: definition.title,
                        blockType: 'ai',
                        status: 'idle',
                        aiConfig: {
                            prompt: '',
                            models: [...defaultAiConfig.models],
                        },
                    },
                };
            }

            return {
                id,
                type: 'customBlock',
                position,
                data: {
                    title: definition.title,
                    subtitle: definition.subtitle,
                    description: definition.description,
                    icon: definition.icon,
                    blockType: definition.blockType,
                    status: 'idle',
                },
            };
        },
        [createNodeId, getCanvasCenterPosition],
    );

    useEffect(() => {
        if (!blockRequest || readonly || !reactFlowInstance) {
            return;
        }

        const newNode = createNodeFromRequest(blockRequest);

        setNodes((currentNodes) => [...currentNodes, newNode]);
        onBlockRequestHandled?.(blockRequest.requestId);
    }, [
        blockRequest,
        createNodeFromRequest,
        onBlockRequestHandled,
        reactFlowInstance,
        readonly,
        setNodes,
    ]);

    useEffect(() => {
        if (!onNotebookChange) {
            return;
        }

        const payload = toNotebookPayload({
            notebookId,
            title: notebookTitle,
            nodes,
            edges,
            viewport,
        });

        onNotebookChange(payload);
    }, [
        edges,
        nodes,
        notebookId,
        notebookTitle,
        onNotebookChange,
        viewport,
    ]);

    useEffect(() => {
        if (!initialPayload) {
            return;
        }

        const payloadKey = `${initialPayload.id ?? 'local'}-${initialPayload.updatedAt}`;

        if (loadedPayloadKeyRef.current === payloadKey) {
            return;
        }

        const restoredNotebook = fromNotebookPayload(initialPayload);

        setNodes(restoredNotebook.nodes);
        setEdges(restoredNotebook.edges);
        loadedPayloadKeyRef.current = payloadKey;

        if (initialPayload.viewport && reactFlowInstance) {
            window.requestAnimationFrame(() => {
                reactFlowInstance.setViewport(initialPayload.viewport!);
            });
        }
    }, [initialPayload, reactFlowInstance, setEdges, setNodes]);

    useEffect(() => {
        if (!autoLayoutRequest) {
            return;
        }

        if (readonly) {
            onAutoLayoutRequestHandled?.(autoLayoutRequest.requestId);
            return;
        }

        const result = autoLayoutWorkflow({
            nodes,
            edges,
            mode: autoLayoutRequest.mode,
        });

        setNodes(result.nodes);
        setEdges(result.edges);

        window.requestAnimationFrame(() => {
            reactFlowInstance?.fitView({
                padding: 0.18,
            });
        });

        onExecutionLogsChange?.([
            createExecutionLog({
                level: 'info',
                status: 'idle',
                message:
                    `Автосборка схемы завершена. ` +
                    `Создано блоков: ${result.createdNodesCount}. ` +
                    `Перемещено блоков: ${result.movedNodesCount}. ` +
                    `Добавлено связей: ${result.createdEdgesCount}.`,
            }),
        ]);

        onExecutionStatusChange?.('idle');
        onAutoLayoutRequestHandled?.(autoLayoutRequest.requestId);
    }, [autoLayoutRequest, edges, nodes, onAutoLayoutRequestHandled, onExecutionLogsChange, onExecutionStatusChange, reactFlowInstance, readonly, setEdges, setNodes]);

    const getAvailableConditionBranch = useCallback(
        (sourceNodeId: string) => getAvailableConditionBranchForEdges(sourceNodeId, edges),
        [edges],
    );

    const onConnect = useCallback(
        (connection: Connection) => {
            if (readonly || !connection.source || !connection.target) {
                return;
            }

            const sourceNode = nodes.find((node) => node.id === connection.source);

            if (sourceNode?.data.blockType === 'condition') {
                const branch = getAvailableConditionBranch(connection.source);

                if (!branch) {
                    onExecutionLogsChange?.([
                        createExecutionLog({
                            level: 'warning',
                            status: 'idle',
                            blockId: sourceNode.id,
                            blockTitle: sourceNode.data.title,
                            message: `У блока "${sourceNode.data.title}" уже есть две ветки: "Да" и "Нет". Новая связь не добавлена.`,
                        }),
                    ]);

                    return;
                }

                setEdges((currentEdges) =>
                    addEdge(
                        {
                            ...connection,
                            sourceHandle: branch,
                            type: 'smoothstep',
                            label: conditionBranchLabels[branch],
                        },
                        currentEdges,
                    ),
                );

                return;
            }

            setEdges((currentEdges) =>
                addEdge(
                    {
                        ...connection,
                        type: 'smoothstep',
                    },
                    currentEdges,
                ),
            );
        },
        [
            getAvailableConditionBranch,
            nodes,
            onExecutionLogsChange,
            readonly,
            setEdges,
        ],
    );

    const handleEditNode = useCallback((nodeId: string) => {
        setEditingNodeId(nodeId);
    }, []);

    const handleDeleteNode = useCallback(
        (nodeId: string) => {
            if (readonly) {
                return;
            }

            setNodes((currentNodes) =>
                currentNodes.filter((node) => node.id !== nodeId),
            );

            setEdges((currentEdges) =>
                currentEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
            );

            setEditingNodeId((currentEditingNodeId) =>
                currentEditingNodeId === nodeId ? null : currentEditingNodeId,
            );
        },
        [readonly, setEdges, setNodes],
    );

    const handleRunNode = useCallback(
        (nodeId: string) => {
            const runningNode = nodes.find((node) => node.id === nodeId);

            onExecutionStatusChange?.('running');
            onExecutionLogsChange?.([
                createExecutionLog({
                    level: 'info',
                    status: 'running',
                    blockId: nodeId,
                    blockTitle: runningNode?.data.title,
                    message: 'Запущено выполнение отдельного блока.',
                }),
            ]);

            setNodes((currentNodes) =>
                currentNodes.map((node) =>
                    node.id === nodeId
                        ? {
                            ...node,
                            data: {
                                ...node.data,
                                status: 'running',
                            },
                        }
                        : node,
                ),
            );

            window.setTimeout(() => {
                setNodes((currentNodes) =>
                    currentNodes.map((node) =>
                        node.id === nodeId
                            ? {
                                ...node,
                                data: {
                                    ...node.data,
                                    status: 'success',
                                },
                            }
                            : node,
                    ),
                );

                onExecutionLogsChange?.([
                    createExecutionLog({
                        level: 'info',
                        status: 'running',
                        blockId: nodeId,
                        blockTitle: runningNode?.data.title,
                        message: 'Запущено выполнение отдельного блока.',
                    }),
                    createExecutionLog({
                        level: 'success',
                        status: 'success',
                        blockId: nodeId,
                        blockTitle: runningNode?.data.title,
                        message: 'Отдельный блок успешно выполнен.',
                    }),
                ]);

                onExecutionStatusChange?.('success');
            }, 900);
        },
        [
            nodes,
            onExecutionLogsChange,
            onExecutionStatusChange,
            setNodes,
        ],
    );

    const handleRunWorkflow = useCallback(
        async (requestId: number) => {
            if (isWorkflowRunningRef.current) {
                onRunRequestHandled?.(requestId);
                return;
            }

            isWorkflowRunningRef.current = true;

            const startedAt = new Date();
            let completedBlocks = 0;
            let failedBlocks = 0;
            let warningsCount = 0;
            let errorsCount = 0;

            onExecutionResultChange?.(null);

            const executionLogs: NotebookExecutionLog[] = [];

            const emitStatus = (status: WorkflowExecutionStatus) => {
                onExecutionStatusChange?.(status);
            };

            const pushLog = (log: NotebookExecutionLog) => {
                executionLogs.push(log);
                onExecutionLogsChange?.([...executionLogs]);
            };

            try {
                emitStatus('running');
                onExecutionLogsChange?.([]);

                setNodes((currentNodes) =>
                    currentNodes.map((node) => ({
                        ...node,
                        data: {
                            ...node.data,
                            status: 'idle',
                        },
                    })),
                );

                pushLog(
                    createExecutionLog({
                        level: 'info',
                        status: 'running',
                        message: 'Проверка схемы перед запуском рабочего процесса.',
                    }),
                );

                const validationIssues = validateWorkflow(nodes, edges);
                const validationErrors = validationIssues.filter((issue) => issue.severity === 'error');

                validationIssues.forEach((issue) => {
                    if (issue.severity === 'warning') {
                        warningsCount += 1;
                    }

                    if (issue.severity === 'error') {
                        errorsCount += 1;
                    }

                    pushLog(
                        createExecutionLog({
                            level: issue.severity,
                            status: issue.severity === 'error' ? 'error' : 'running',
                            blockId: issue.blockId,
                            blockTitle: issue.blockTitle,
                            message: issue.message,
                        }),
                    );
                });

                if (validationErrors.length > 0) {
                    const invalidBlockIds = new Set(
                        validationErrors
                            .map((issue) => issue.blockId)
                            .filter((blockId): blockId is string => Boolean(blockId)),
                    );

                    setNodes((currentNodes) =>
                        currentNodes.map((node) =>
                            invalidBlockIds.has(node.id)
                                ? {
                                    ...node,
                                    data: {
                                        ...node.data,
                                        status: 'error',
                                    },
                                }
                                : node,
                        ),
                    );

                    pushLog(
                        createExecutionLog({
                            level: 'error',
                            status: 'error',
                            message: `Запуск остановлен. Найдено ошибок: ${validationErrors.length}.`,
                        }),
                    );

                    emitStatus('error');

                    const finishedAt = new Date();

                    onExecutionResultChange?.({
                        id: `${finishedAt.getTime()}-validation-error`,
                        status: 'error',
                        startedAt: startedAt.toISOString(),
                        finishedAt: finishedAt.toISOString(),
                        durationMs: finishedAt.getTime() - startedAt.getTime(),
                        totalBlocks: nodes.length,
                        completedBlocks,
                        failedBlocks: validationErrors.length,
                        warningsCount,
                        errorsCount,
                        summary: 'Рабочий процесс не был запущен',
                        output: `Проверка схемы завершилась с ошибками. Найдено ошибок: ${validationErrors.length}.`,
                    });

                    return;
                }

                pushLog(
                    createExecutionLog({
                        level: 'success',
                        status: 'success',
                        message: 'Схема прошла проверку. Запуск рабочего процесса разрешён.',
                    }),
                );

                const executionOrder = getWorkflowExecutionOrder(nodes, edges);

                if (executionOrder.length === 0) {
                    pushLog(
                        createExecutionLog({
                            level: 'error',
                            status: 'error',
                            message: 'Невозможно запустить рабочий процесс: в схеме нет блоков.',
                        }),
                    );

                    emitStatus('error');
                    return;
                }

                pushLog(
                    createExecutionLog({
                        level: 'info',
                        status: 'running',
                        message: `Запуск рабочего процесса. Блоков к выполнению: ${executionOrder.length}.`,
                    }),
                );

                for (const node of executionOrder) {
                    pushLog(
                        createExecutionLog({
                            level: 'info',
                            status: 'running',
                            blockId: node.id,
                            blockTitle: node.data.title,
                            message: `Блок "${node.data.title}" начал выполнение.`,
                        }),
                    );

                    setNodes((currentNodes) =>
                        currentNodes.map((currentNode) =>
                            currentNode.id === node.id
                                ? {
                                    ...currentNode,
                                    data: {
                                        ...currentNode.data,
                                        status: 'running',
                                    },
                                }
                                : currentNode,
                        ),
                    );

                    await sleep(node.data.blockType === 'ai' ? 1100 : 650);

                    setNodes((currentNodes) =>
                        currentNodes.map((currentNode) =>
                            currentNode.id === node.id
                                ? {
                                    ...currentNode,
                                    data: {
                                        ...currentNode.data,
                                        status: 'success',
                                    },
                                }
                                : currentNode,
                        ),
                    );

                    completedBlocks += 1;

                    pushLog(
                        createExecutionLog({
                            level: 'success',
                            status: 'success',
                            blockId: node.id,
                            blockTitle: node.data.title,
                            message: `Блок "${node.data.title}" успешно выполнен.`,
                        }),
                    );
                }

                pushLog(
                    createExecutionLog({
                        level: 'success',
                        status: 'success',
                        message: 'Рабочий процесс успешно завершён.',
                    }),
                );

                const finishedAt = new Date();

                onExecutionResultChange?.({
                    id: `${finishedAt.getTime()}-success`,
                    status: 'success',
                    startedAt: startedAt.toISOString(),
                    finishedAt: finishedAt.toISOString(),
                    durationMs: finishedAt.getTime() - startedAt.getTime(),
                    totalBlocks: executionOrder.length,
                    completedBlocks,
                    failedBlocks,
                    warningsCount,
                    errorsCount,
                    summary: 'Рабочий процесс успешно завершён',
                    output:
                        `Выполнено блоков: ${completedBlocks} из ${executionOrder.length}. ` +
                        'Результат сохранён как frontend-заглушка. Позже здесь будет ответ Execution Service.',
                });

                emitStatus('success');
            } catch (error) {
                pushLog(
                    createExecutionLog({
                        level: 'error',
                        status: 'error',
                        message:
                            error instanceof Error
                                ? error.message
                                : 'Во время выполнения рабочего процесса произошла ошибка.',
                    }),
                );

                const finishedAt = new Date();

                failedBlocks += 1;
                errorsCount += 1;

                onExecutionResultChange?.({
                    id: `${finishedAt.getTime()}-runtime-error`,
                    status: 'error',
                    startedAt: startedAt.toISOString(),
                    finishedAt: finishedAt.toISOString(),
                    durationMs: finishedAt.getTime() - startedAt.getTime(),
                    totalBlocks: nodes.length,
                    completedBlocks,
                    failedBlocks,
                    warningsCount,
                    errorsCount,
                    summary: 'Рабочий процесс завершился с ошибкой',
                    output:
                        error instanceof Error
                            ? error.message
                            : 'Во время выполнения рабочего процесса произошла ошибка.',
                });

                emitStatus('error');
            } finally {
                isWorkflowRunningRef.current = false;
                onRunRequestHandled?.(requestId);
            }
        },
        [
            edges,
            nodes,
            onExecutionLogsChange,
            onExecutionStatusChange,
            onExecutionResultChange,
            onRunRequestHandled,
            setNodes,
        ],
    );

    useEffect(() => {
        if (!runRequest) {
            return;
        }

        void handleRunWorkflow(runRequest.requestId);
    }, [handleRunWorkflow, runRequest]);

    const visibleNodes = useMemo(
        () =>
            nodes.map((node) => ({
                ...node,
                data: {
                    ...node.data,
                    onEdit: handleEditNode,
                    onDelete: handleDeleteNode,
                    onRun: handleRunNode,
                },
            })),
        [handleDeleteNode, handleEditNode, handleRunNode, nodes],
    );

    const handleSaveAiBlock = (title: string, config: AiBlockConfig) => {
        if (!editingNodeId) {
            return;
        }

        setNodes((currentNodes) =>
            currentNodes.map((node) =>
                node.id === editingNodeId
                    ? {
                        ...node,
                        data: {
                            ...node.data,
                            title,
                            aiConfig: config,
                        },
                    }
                    : node,
            ),
        );

        setEditingNodeId(null);
    };

    const handleSaveGenericBlock = (settings: BlockSettingsPayload) => {
        if (!editingNodeId) {
            return;
        }

        setNodes((currentNodes) =>
            currentNodes.map((node) =>
                node.id === editingNodeId
                    ? {
                        ...node,
                        data: {
                            ...node.data,
                            title: settings.title,
                            subtitle: settings.subtitle,
                            description: settings.description,
                            config: settings.config,
                        },
                    }
                    : node,
            ),
        );

        setEditingNodeId(null);
    };

    const handleSaveEdgeLabel = (label: string) => {
        if (!editingEdgeId) {
            return;
        }

        setEdges((currentEdges) =>
            currentEdges.map((edge) =>
                edge.id === editingEdgeId
                    ? {
                        ...edge,
                        label: label || undefined,
                    }
                    : edge,
            ),
        );

        setEditingEdgeId(null);
    };

    return (
        <div className="notebook-canvas" ref={canvasRef}>
            <ReactFlow<NotebookNode, Edge>
                nodes={visibleNodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onInit={setReactFlowInstance}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onEdgeDoubleClick={(event, edge) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setEditingEdgeId(edge.id);
                }}
                onMoveEnd={(_, currentViewport) => setViewport(currentViewport)}
                nodesDraggable={!readonly}
                nodesConnectable={!readonly}
                elementsSelectable
                panOnDrag
                zoomOnScroll
                fitView
            >
                <Background />
                <Controls />
                {!readonly && <MiniMap pannable zoomable />}
            </ReactFlow>

            {editingNode && editingNode.data.blockType === 'ai' && (
                <AiBlockModal
                    initialTitle={editingNode.data.title}
                    initialConfig={editingConfig}
                    onSave={handleSaveAiBlock}
                    onClose={() => setEditingNodeId(null)}
                />
            )}

            {editingEdge && (
                <EdgeSettingsModal
                    initialLabel={typeof editingEdge.label === 'string' ? editingEdge.label : ''}
                    onSave={handleSaveEdgeLabel}
                    onClose={() => setEditingEdgeId(null)}
                />
            )}

            {editingNode && editingNode.data.blockType !== 'ai' && (
                <BlockSettingsModal
                    blockType={editingNode.data.blockType}
                    initialTitle={editingNode.data.title}
                    initialSubtitle={editingNode.data.subtitle}
                    initialDescription={editingNode.data.description}
                    initialConfig={editingNode.data.config}
                    onSave={handleSaveGenericBlock}
                    onClose={() => setEditingNodeId(null)}
                />
            )}
        </div>
    );
}

export default NotebookCanvas;

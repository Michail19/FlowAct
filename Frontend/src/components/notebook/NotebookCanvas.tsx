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
import BlockSettingsModal from './BlockSettingsModal';
import { DEFAULT_AI_MODEL_ID } from './aiModels';
import { getBlockDefinition } from './blockLibrary';
import type {
    AiBlockConfig,
    NotebookBlockRequest,
    NotebookNode,
} from './notebookTypes';
import type {
    NotebookExecutionLog,
    WorkflowExecutionStatus,
    WorkflowRunRequest,
} from './executionTypes';
import type { NotebookPayloadDto } from './notebookBackendTypes';
import { fromNotebookPayload, toNotebookPayload } from './notebookMapper';

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
};

const defaultAiConfig: AiBlockConfig = {
    prompt: 'Проанализируй входящий текст пользователя и подготовь структурированный ответ.',
    models: [DEFAULT_AI_MODEL_ID],
};

const retryAiConfig: AiBlockConfig = {
    prompt: 'Повтори обработку результата, исправь ошибки и подготовь новый вариант ответа.',
    models: [DEFAULT_AI_MODEL_ID],
};

const initialNodes: NotebookNode[] = [
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

const initialEdges: Edge[] = [
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

function sleep(ms: number) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

function createExecutionLog(params: {
    level: NotebookExecutionLog['level'];
    status: WorkflowExecutionStatus;
    message: string;
    blockId?: string;
    blockTitle?: string;
}): NotebookExecutionLog {
    return {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        level: params.level,
        status: params.status,
        message: params.message,
        blockId: params.blockId,
        blockTitle: params.blockTitle,
        createdAt: new Date().toISOString(),
    };
}

function getWorkflowExecutionOrder(nodes: NotebookNode[], edges: Edge[]): NotebookNode[] {
    if (nodes.length === 0) {
        return [];
    }

    const nodeMap = new Map(nodes.map((node) => [node.id, node]));

    const outgoingEdges = edges.reduce<Map<string, Edge[]>>((map, edge) => {
        const list = map.get(edge.source) ?? [];
        list.push(edge);
        map.set(edge.source, list);
        return map;
    }, new Map());

    const startNode =
        nodes.find((node) => node.data.blockType === 'start') ??
        [...nodes].sort((firstNode, secondNode) => firstNode.position.x - secondNode.position.x)[0];

    const visitedNodeIds = new Set<string>();
    const orderedNodes: NotebookNode[] = [];

    const visit = (nodeId: string) => {
        if (visitedNodeIds.has(nodeId)) {
            return;
        }

        const node = nodeMap.get(nodeId);

        if (!node) {
            return;
        }

        visitedNodeIds.add(nodeId);
        orderedNodes.push(node);

        const nextEdges = [...(outgoingEdges.get(nodeId) ?? [])].sort((firstEdge, secondEdge) => {
            const firstLabel = typeof firstEdge.label === 'string' ? firstEdge.label : '';
            const secondLabel = typeof secondEdge.label === 'string' ? secondEdge.label : '';

            return firstLabel.localeCompare(secondLabel);
        });

        nextEdges.forEach((edge) => visit(edge.target));
    };

    visit(startNode.id);

    const disconnectedNodes = nodes
        .filter((node) => !visitedNodeIds.has(node.id))
        .sort((firstNode, secondNode) => {
            if (firstNode.position.x !== secondNode.position.x) {
                return firstNode.position.x - secondNode.position.x;
            }

            return firstNode.position.y - secondNode.position.y;
        });

    return [...orderedNodes, ...disconnectedNodes];
}

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

    const nodeTypes = useMemo<NodeTypes>(
        () => ({
            aiBlock: AiBlockNode,
            customBlock: CustomBlockNode,
        }),
        [],
    );

    const editingNode = nodes.find((node) => node.id === editingNodeId);
    const editingConfig = editingNode?.data.aiConfig ?? defaultAiConfig;

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
                            models: [DEFAULT_AI_MODEL_ID],
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

    const onConnect = useCallback(
        (connection: Connection) => {
            if (readonly) {
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
        [readonly, setEdges],
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

            const executionLogs: NotebookExecutionLog[] = [];

            const emitStatus = (status: WorkflowExecutionStatus) => {
                onExecutionStatusChange?.(status);
            };

            const pushLog = (log: NotebookExecutionLog) => {
                executionLogs.push(log);
                onExecutionLogsChange?.([...executionLogs]);
            };

            try {
                const executionOrder = getWorkflowExecutionOrder(nodes, edges);

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

    const handleSaveGenericBlock = (title: string, subtitle: string, description: string) => {
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
                            subtitle,
                            description,
                        },
                    }
                    : node,
            ),
        );

        setEditingNodeId(null);
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

            {editingNode && editingNode.data.blockType !== 'ai' && (
                <BlockSettingsModal
                    initialTitle={editingNode.data.title}
                    initialSubtitle={editingNode.data.subtitle}
                    initialDescription={editingNode.data.description}
                    onSave={handleSaveGenericBlock}
                    onClose={() => setEditingNodeId(null)}
                />
            )}
        </div>
    );
}

export default NotebookCanvas;

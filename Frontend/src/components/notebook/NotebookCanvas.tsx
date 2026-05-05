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
    NotebookHistoryRequest,
    NotebookHistoryState,
    NotebookNode,
    NotebookSearchRequest,
    NotebookSearchResult,
    NotebookViewportRequest,
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
    getConditionBranchFromEdge,
} from './conditionBranchUtils';
import {
    createExecutionLog,
    getWorkflowExecutionPlan,
    sleep,
} from './workflowExecution';
import { executionApi } from '../../services/executionApi';
import type { BackendJsonObject } from '../../services/workflowApiTypes';
import {
    toNotebookExecutionLog,
    toWorkflowExecutionResult,
} from './executionApiMapper';
import { toBackendWorkflowRequest } from './backendWorkflowMapper';
import {
    mapApiExecutionLogStatus,
    mapApiExecutionStatus,
} from './executionTypes';

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
    viewportRequest?: NotebookViewportRequest | null;
    onViewportRequestHandled?: (requestId: number) => void;
    searchRequest?: NotebookSearchRequest | null;
    onSearchRequestHandled?: (result: NotebookSearchResult) => void;
    historyRequest?: NotebookHistoryRequest | null;
    onHistoryRequestHandled?: (requestId: number) => void;
    onHistoryStateChange?: (state: NotebookHistoryState) => void;
};

function normalizeSearchQuery(query: string) {
    return query.trim().toLowerCase();
}

function getSearchableNodeContent(node: NotebookNode) {
    const configText = node.data.config
        ? JSON.stringify(node.data.config)
        : '';

    const aiConfigText = node.data.aiConfig
        ? JSON.stringify(node.data.aiConfig)
        : '';

    return [
        node.data.title,
        node.data.subtitle,
        node.data.description,
        node.data.blockType,
        node.data.meta,
        node.data.icon,
        configText,
        aiConfigText,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

function sortNodesForSearch(nodes: NotebookNode[]) {
    return [...nodes].sort((firstNode, secondNode) => {
        if (firstNode.position.x !== secondNode.position.x) {
            return firstNode.position.x - secondNode.position.x;
        }

        if (firstNode.position.y !== secondNode.position.y) {
            return firstNode.position.y - secondNode.position.y;
        }

        return firstNode.id.localeCompare(secondNode.id);
    });
}

function getApproximateNodeWidth(node: NotebookNode) {
    return node.data.blockType === 'ai' ? 380 : 290;
}

type NotebookHistorySnapshot = {
    nodes: NotebookNode[];
    edges: Edge[];
};

type NotebookHistoryStorageState = {
    snapshots: NotebookHistorySnapshot[];
    currentIndex: number;
};

const NOTEBOOK_HISTORY_LIMIT = 15;

function getNotebookHistoryStorageKey(notebookId?: string) {
    return `flowact-history:${notebookId ?? 'draft'}`;
}

function sanitizeNodeForHistory(node: NotebookNode): NotebookNode {
    return {
        id: node.id,
        type: node.type,
        position: {
            x: node.position.x,
            y: node.position.y,
        },
        selected: false,
        data: {
            title: node.data.title,
            subtitle: node.data.subtitle,
            description: node.data.description,
            blockType: node.data.blockType,
            status: 'idle',
            icon: node.data.icon,
            meta: node.data.meta,
            aiConfig: node.data.aiConfig,
            config: node.data.config,
        },
    };
}

function sanitizeEdgeForHistory(edge: Edge): Edge {
    return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,
        type: edge.type,
        label: edge.label,
    };
}

function createHistorySnapshot(nodes: NotebookNode[], edges: Edge[]): NotebookHistorySnapshot {
    return {
        nodes: nodes.map(sanitizeNodeForHistory),
        edges: edges.map(sanitizeEdgeForHistory),
    };
}

function serializeHistorySnapshot(snapshot: NotebookHistorySnapshot) {
    return JSON.stringify(snapshot);
}

function createInitialHistoryStorageState(
    snapshot: NotebookHistorySnapshot,
): NotebookHistoryStorageState {
    return {
        snapshots: [snapshot],
        currentIndex: 0,
    };
}

function readHistoryStorageState(
    notebookId: string | undefined,
): NotebookHistoryStorageState | null {
    try {
        const rawValue = window.sessionStorage.getItem(
            getNotebookHistoryStorageKey(notebookId),
        );

        if (!rawValue) {
            return null;
        }

        return JSON.parse(rawValue) as NotebookHistoryStorageState;
    } catch {
        return null;
    }
}

function writeHistoryStorageState(
    notebookId: string | undefined,
    state: NotebookHistoryStorageState,
) {
    window.sessionStorage.setItem(
        getNotebookHistoryStorageKey(notebookId),
        JSON.stringify(state),
    );
}

function getHistoryState(state: NotebookHistoryStorageState): NotebookHistoryState {
    return {
        canUndo: state.currentIndex > 0,
        canRedo: state.currentIndex < state.snapshots.length - 1,
    };
}

function pushHistorySnapshot(params: {
    notebookId?: string;
    currentState: NotebookHistoryStorageState | null;
    snapshot: NotebookHistorySnapshot;
}): NotebookHistoryStorageState {
    const snapshotKey = serializeHistorySnapshot(params.snapshot);

    if (!params.currentState) {
        const initialState = createInitialHistoryStorageState(params.snapshot);

        writeHistoryStorageState(params.notebookId, initialState);

        return initialState;
    }

    const currentSnapshot =
        params.currentState.snapshots[params.currentState.currentIndex];

    if (currentSnapshot && serializeHistorySnapshot(currentSnapshot) === snapshotKey) {
        return params.currentState;
    }

    const snapshotsBeforeCurrentIndex = params.currentState.snapshots.slice(
        0,
        params.currentState.currentIndex + 1,
    );

    const nextSnapshots = [...snapshotsBeforeCurrentIndex, params.snapshot].slice(
        -NOTEBOOK_HISTORY_LIMIT,
    );

    const nextState: NotebookHistoryStorageState = {
        snapshots: nextSnapshots,
        currentIndex: nextSnapshots.length - 1,
    };

    writeHistoryStorageState(params.notebookId, nextState);

    return nextState;
}

const BACKEND_EXECUTION_POLL_INTERVAL_MS = 900;
const BACKEND_EXECUTION_MAX_POLLS = 120;

function isBackendExecutionFinished(status: ReturnType<typeof mapApiExecutionStatus>) {
    return status === 'success' || status === 'error' || status === 'cancelled';
}

function createBackendBlockIdToFrontendBlockIdMap(params: {
    notebookId?: string;
    notebookTitle: string;
    nodes: NotebookNode[];
    edges: Edge[];
    viewport?: Viewport;
    serverNotebookId: string;
    workflowId: string;
}) {
    const frontendPayload = toNotebookPayload({
        notebookId: params.notebookId,
        title: params.notebookTitle,
        nodes: params.nodes,
        edges: params.edges,
        viewport: params.viewport,
    });

    const backendPayload = toBackendWorkflowRequest({
        ...frontendPayload,
        serverNotebookId: params.serverNotebookId,
        workflowId: params.workflowId,
    });

    return new Map(
        backendPayload.blocks.map((backendBlock, index) => [
            backendBlock.id,
            frontendPayload.blocks[index]?.id ?? backendBlock.id,
        ]),
    );
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
                            onExecutionResultChange,
                            autoLayoutRequest = null,
                            onAutoLayoutRequestHandled,
                            viewportRequest = null,
                            onViewportRequestHandled,
                            searchRequest = null,
                            onSearchRequestHandled,
                            historyRequest = null,
                            onHistoryRequestHandled,
                            onHistoryStateChange,
                        }: NotebookCanvasProps) {
    const canvasRef = useRef<HTMLDivElement | null>(null);
    const nodeCounterRef = useRef(initialNodes.length);
    const loadedPayloadKeyRef = useRef<string | null>(null);
    const isWorkflowRunningRef = useRef(false);
    const lastSearchResultRef = useRef<{
        query: string;
        nodeId: string | null;
    }>({
        query: '',
        nodeId: null,
    });
    const historyStateRef = useRef<NotebookHistoryStorageState | null>(null);
    const shouldSkipNextHistoryRecordRef = useRef(false);

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

        shouldSkipNextHistoryRecordRef.current = true;

        setNodes(restoredNotebook.nodes);
        setEdges(restoredNotebook.edges);
        loadedPayloadKeyRef.current = payloadKey;

        const initialSnapshot = createHistorySnapshot(
            restoredNotebook.nodes,
            restoredNotebook.edges,
        );

        historyStateRef.current = pushHistorySnapshot({
            notebookId,
            currentState: readHistoryStorageState(notebookId),
            snapshot: initialSnapshot,
        });

        onHistoryStateChange?.(getHistoryState(historyStateRef.current));

        if (initialPayload.viewport && reactFlowInstance) {
            window.requestAnimationFrame(() => {
                reactFlowInstance.setViewport(initialPayload.viewport!);
            });
        }
    }, [initialPayload, reactFlowInstance, setEdges, setNodes, notebookId, onHistoryStateChange]);

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

    useEffect(() => {
        if (!viewportRequest || !reactFlowInstance) {
            return;
        }

        const animationFrameId = window.requestAnimationFrame(() => {
            if (viewportRequest.mode === 'fit') {
                void reactFlowInstance.fitView({
                    padding: 0.18,
                });

                onViewportRequestHandled?.(viewportRequest.requestId);
                return;
            }

            const currentViewport = reactFlowInstance.getViewport();

            const nextViewport: Viewport = {
                ...currentViewport,
                zoom: viewportRequest.zoom,
            };

            void reactFlowInstance.setViewport(nextViewport);
            setViewport(nextViewport);
            onViewportRequestHandled?.(viewportRequest.requestId);
        });

        return () => {
            window.cancelAnimationFrame(animationFrameId);
        };
    }, [
        onViewportRequestHandled,
        reactFlowInstance,
        viewportRequest,
    ]);

    useEffect(() => {
        if (!searchRequest || !reactFlowInstance) {
            return;
        }

        const animationFrameId = window.requestAnimationFrame(() => {
            const normalizedQuery = normalizeSearchQuery(searchRequest.query);

            if (!normalizedQuery) {
                lastSearchResultRef.current = {
                    query: '',
                    nodeId: null,
                };

                setNodes((currentNodes) =>
                    currentNodes.map((node) => ({
                        ...node,
                        selected: false,
                    })),
                );

                onSearchRequestHandled?.({
                    requestId: searchRequest.requestId,
                    query: searchRequest.query,
                    found: false,
                    total: 0,
                });

                return;
            }

            const matchedNodes = sortNodesForSearch(nodes).filter((node) =>
                getSearchableNodeContent(node).includes(normalizedQuery),
            );

            if (matchedNodes.length === 0) {
                lastSearchResultRef.current = {
                    query: normalizedQuery,
                    nodeId: null,
                };

                setNodes((currentNodes) =>
                    currentNodes.map((node) => ({
                        ...node,
                        selected: false,
                    })),
                );

                onSearchRequestHandled?.({
                    requestId: searchRequest.requestId,
                    query: searchRequest.query,
                    found: false,
                    total: 0,
                });

                return;
            }

            let activeIndex = 0;

            if (lastSearchResultRef.current.query === normalizedQuery) {
                const previousIndex = matchedNodes.findIndex(
                    (node) => node.id === lastSearchResultRef.current.nodeId,
                );

                activeIndex =
                    previousIndex >= 0
                        ? (previousIndex + 1) % matchedNodes.length
                        : 0;
            }

            const matchedNode = matchedNodes[activeIndex];

            lastSearchResultRef.current = {
                query: normalizedQuery,
                nodeId: matchedNode.id,
            };

            setNodes((currentNodes) =>
                currentNodes.map((node) => ({
                    ...node,
                    selected: node.id === matchedNode.id,
                })),
            );

            const currentViewport = reactFlowInstance.getViewport();
            const nodeWidth = getApproximateNodeWidth(matchedNode);

            void reactFlowInstance.setCenter(
                matchedNode.position.x + nodeWidth / 2,
                matchedNode.position.y + 90,
                {
                    zoom: Math.max(currentViewport.zoom, 0.9),
                    duration: 450,
                },
            );

            onSearchRequestHandled?.({
                requestId: searchRequest.requestId,
                query: searchRequest.query,
                found: true,
                total: matchedNodes.length,
                activeIndex,
                matchedNodeId: matchedNode.id,
                matchedTitle: matchedNode.data.title,
            });
        });

        return () => {
            window.cancelAnimationFrame(animationFrameId);
        };
    }, [
        nodes,
        onSearchRequestHandled,
        reactFlowInstance,
        searchRequest,
        setNodes,
    ]);

    useEffect(() => {
        if (shouldSkipNextHistoryRecordRef.current) {
            shouldSkipNextHistoryRecordRef.current = false;
            return;
        }

        const snapshot = createHistorySnapshot(nodes, edges);

        historyStateRef.current = pushHistorySnapshot({
            notebookId,
            currentState: historyStateRef.current,
            snapshot,
        });

        onHistoryStateChange?.(getHistoryState(historyStateRef.current));
    }, [
        edges,
        nodes,
        notebookId,
        onHistoryStateChange,
    ]);

    useEffect(() => {
        if (!historyRequest) {
            return;
        }

        const animationFrameId = window.requestAnimationFrame(() => {
            const currentState =
                historyStateRef.current ?? readHistoryStorageState(notebookId);

            if (!currentState) {
                onHistoryRequestHandled?.(historyRequest.requestId);
                return;
            }

            const nextIndex =
                historyRequest.action === 'undo'
                    ? Math.max(0, currentState.currentIndex - 1)
                    : Math.min(
                        currentState.snapshots.length - 1,
                        currentState.currentIndex + 1,
                    );

            if (nextIndex === currentState.currentIndex) {
                onHistoryStateChange?.(getHistoryState(currentState));
                onHistoryRequestHandled?.(historyRequest.requestId);
                return;
            }

            const nextState: NotebookHistoryStorageState = {
                ...currentState,
                currentIndex: nextIndex,
            };

            const snapshot = nextState.snapshots[nextIndex];

            if (!snapshot) {
                onHistoryStateChange?.(getHistoryState(currentState));
                onHistoryRequestHandled?.(historyRequest.requestId);
                return;
            }

            shouldSkipNextHistoryRecordRef.current = true;
            historyStateRef.current = nextState;
            writeHistoryStorageState(notebookId, nextState);

            setNodes(snapshot.nodes);
            setEdges(snapshot.edges);

            onHistoryStateChange?.(getHistoryState(nextState));
            onHistoryRequestHandled?.(historyRequest.requestId);
        });

        return () => {
            window.cancelAnimationFrame(animationFrameId);
        };
    }, [
        historyRequest,
        notebookId,
        onHistoryRequestHandled,
        onHistoryStateChange,
        setEdges,
        setNodes,
    ]);

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

    const handleRunBackendWorkflow = useCallback(
        async (request: WorkflowRunRequest) => {
            if (!request.serverNotebookId || !request.workflowId) {
                return false;
            }

            if (isWorkflowRunningRef.current) {
                onRunRequestHandled?.(request.requestId);
                return true;
            }

            isWorkflowRunningRef.current = true;

            const startedAt = new Date();

            const backendBlockIdToFrontendBlockId = createBackendBlockIdToFrontendBlockIdMap({
                notebookId,
                notebookTitle,
                nodes,
                edges,
                viewport,
                serverNotebookId: request.serverNotebookId,
                workflowId: request.workflowId,
            });

            const frontendTitleByNodeId = new Map(
                nodes.map((node) => [node.id, node.data.title]),
            );

            const startLog = createExecutionLog({
                level: 'info',
                status: 'running',
                message: 'Запуск workflow через ExecutionService.',
            });

            try {
                onExecutionResultChange?.(null);
                onExecutionStatusChange?.('running');
                onExecutionLogsChange?.([startLog]);

                setNodes((currentNodes) =>
                    currentNodes.map((node) => ({
                        ...node,
                        data: {
                            ...node.data,
                            status: 'pending',
                        },
                    })),
                );

                const createdExecution = await executionApi.run(
                    request.serverNotebookId,
                    request.workflowId,
                    {
                        inputData: (request.inputData ?? {}) as BackendJsonObject,
                    },
                );

                let currentExecution = createdExecution;

                for (
                    let pollIndex = 0;
                    pollIndex < BACKEND_EXECUTION_MAX_POLLS;
                    pollIndex += 1
                ) {
                    const workflowStatus = mapApiExecutionStatus(currentExecution.status);

                    onExecutionStatusChange?.(workflowStatus);

                    const backendLogs = await executionApi.getLogs(
                        request.serverNotebookId,
                        request.workflowId,
                        currentExecution.id,
                    );

                    const mappedLogs = backendLogs.map((log) => {
                        const frontendBlockId =
                            backendBlockIdToFrontendBlockId.get(log.blockId) ?? log.blockId;

                        return {
                            ...toNotebookExecutionLog(log),
                            blockId: frontendBlockId,
                            blockTitle: frontendTitleByNodeId.get(frontendBlockId),
                        };
                    });

                    onExecutionLogsChange?.([startLog, ...mappedLogs]);

                    const statusByFrontendNodeId = new Map(
                        backendLogs.map((log) => {
                            const frontendBlockId =
                                backendBlockIdToFrontendBlockId.get(log.blockId) ??
                                log.blockId;

                            return [
                                frontendBlockId,
                                mapApiExecutionLogStatus(log.status),
                            ] as const;
                        }),
                    );

                    setNodes((currentNodes) =>
                        currentNodes.map((node) => {
                            const nextStatus = statusByFrontendNodeId.get(node.id);

                            if (!nextStatus) {
                                return node;
                            }

                            return {
                                ...node,
                                data: {
                                    ...node.data,
                                    status: nextStatus,
                                },
                            };
                        }),
                    );

                    if (isBackendExecutionFinished(workflowStatus)) {
                        const result = toWorkflowExecutionResult(currentExecution);

                        if (result) {
                            onExecutionResultChange?.({
                                ...result,
                                totalBlocks: nodes.length,
                                completedBlocks: backendLogs.filter(
                                    (log) => log.status === 'SUCCESS',
                                ).length,
                                failedBlocks: backendLogs.filter(
                                    (log) => log.status === 'FAILED',
                                ).length,
                                warningsCount: backendLogs.filter(
                                    (log) =>
                                        log.status === 'SKIPPED' ||
                                        log.status === 'WAITING',
                                ).length,
                                errorsCount: backendLogs.filter(
                                    (log) => log.status === 'FAILED',
                                ).length,
                            });
                        }

                        if (workflowStatus === 'error') {
                            setNodes((currentNodes) =>
                                currentNodes.map((node) =>
                                    statusByFrontendNodeId.has(node.id)
                                        ? node
                                        : {
                                            ...node,
                                            data: {
                                                ...node.data,
                                                status: 'skipped',
                                            },
                                        },
                                ),
                            );
                        }

                        return true;
                    }

                    await sleep(BACKEND_EXECUTION_POLL_INTERVAL_MS);

                    currentExecution = await executionApi.getById(
                        request.serverNotebookId,
                        request.workflowId,
                        currentExecution.id,
                    );
                }

                const finishedAt = new Date();

                onExecutionStatusChange?.('waiting');
                onExecutionResultChange?.({
                    id: `${finishedAt.getTime()}-backend-timeout`,
                    status: 'error',
                    startedAt: startedAt.toISOString(),
                    finishedAt: finishedAt.toISOString(),
                    durationMs: finishedAt.getTime() - startedAt.getTime(),
                    totalBlocks: nodes.length,
                    completedBlocks: 0,
                    failedBlocks: 1,
                    warningsCount: 1,
                    errorsCount: 1,
                    summary: 'Backend execution не завершился за отведённое время',
                    output: 'Polling остановлен по лимиту попыток.',
                });

                return true;
            } catch (error) {
                const finishedAt = new Date();

                onExecutionStatusChange?.('error');
                onExecutionLogsChange?.([
                    startLog,
                    createExecutionLog({
                        level: 'error',
                        status: 'error',
                        message:
                            error instanceof Error
                                ? `Backend execution failed: ${error.message}`
                                : 'Backend execution failed.',
                    }),
                ]);
                onExecutionResultChange?.({
                    id: `${finishedAt.getTime()}-backend-error`,
                    status: 'error',
                    startedAt: startedAt.toISOString(),
                    finishedAt: finishedAt.toISOString(),
                    durationMs: finishedAt.getTime() - startedAt.getTime(),
                    totalBlocks: nodes.length,
                    completedBlocks: 0,
                    failedBlocks: 1,
                    warningsCount: 0,
                    errorsCount: 1,
                    summary: 'Ошибка запуска через ExecutionService',
                    output:
                        error instanceof Error
                            ? error.message
                            : 'Неизвестная ошибка backend execution.',
                });

                console.warn('Backend execution failed:', error);

                return true;
            } finally {
                isWorkflowRunningRef.current = false;
                onRunRequestHandled?.(request.requestId);
            }
        },
        [
            edges,
            nodes,
            notebookId,
            notebookTitle,
            onExecutionLogsChange,
            onExecutionResultChange,
            onExecutionStatusChange,
            onRunRequestHandled,
            setNodes,
            viewport,
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

                const executionPlan = getWorkflowExecutionPlan(nodes, edges);
                const executionOrder = executionPlan.orderedNodes;
                const skippedNodeIds = executionPlan.skippedNodeIds;

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

                if (skippedNodeIds.size > 0) {
                    setNodes((currentNodes) =>
                        currentNodes.map((node) =>
                            skippedNodeIds.has(node.id)
                                ? {
                                    ...node,
                                    data: {
                                        ...node.data,
                                        status: 'skipped',
                                    },
                                }
                                : node,
                        ),
                    );

                    pushLog(
                        createExecutionLog({
                            level: 'warning',
                            status: 'running',
                            message: `Пропущено блоков из невыбранных веток condition: ${skippedNodeIds.size}.`,
                        }),
                    );
                }

                const successfulNodeIds = new Set<string>();
                const skippedExecutionNodeIds = new Set<string>(skippedNodeIds);

                const incomingEdgesByNodeId = edges.reduce<Map<string, Edge[]>>((map, edge) => {
                    const nodeEdges = map.get(edge.target) ?? [];

                    nodeEdges.push(edge);
                    map.set(edge.target, nodeEdges);

                    return map;
                }, new Map());

                for (const node of executionOrder) {
                    const incomingEdges = incomingEdgesByNodeId.get(node.id) ?? [];

                    const hasSuccessfulInput =
                        node.data.blockType === 'start' ||
                        incomingEdges.length === 0 ||
                        incomingEdges.some((edge) => successfulNodeIds.has(edge.source));

                    if (skippedExecutionNodeIds.has(node.id) || !hasSuccessfulInput) {
                        skippedExecutionNodeIds.add(node.id);

                        setNodes((currentNodes) =>
                            currentNodes.map((currentNode) =>
                                currentNode.id === node.id
                                    ? {
                                        ...currentNode,
                                        data: {
                                            ...currentNode.data,
                                            status: 'skipped',
                                        },
                                    }
                                    : currentNode,
                            ),
                        );

                        pushLog(
                            createExecutionLog({
                                level: 'warning',
                                status: 'running',
                                blockId: node.id,
                                blockTitle: node.data.title,
                                message: `Блок "${node.data.title}" пропущен: входные данные не поступили.`,
                            }),
                        );

                        continue;
                    }

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
                    successfulNodeIds.add(node.id);

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

        if (runRequest.serverNotebookId && runRequest.workflowId) {
            void handleRunBackendWorkflow(runRequest);
            return;
        }

        void handleRunWorkflow(runRequest.requestId);
    }, [
        handleRunBackendWorkflow,
        handleRunWorkflow,
        runRequest,
    ]);

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
                            subtitle: getSubtitleByBlockConfig(settings),
                            description: settings.description,
                            config: settings.config,
                        },
                    }
                    : node,
            ),
        );

        setEditingNodeId(null);
    };

    const handleSaveEdgeLabel = (label: string, branch?: 'yes' | 'no') => {
        if (!editingEdgeId) {
            return;
        }

        setEdges((currentEdges) =>
            currentEdges.map((edge) =>
                edge.id === editingEdgeId
                    ? {
                        ...edge,
                        label: branch ? conditionBranchLabels[branch] : label || undefined,
                        sourceHandle: branch ?? edge.sourceHandle,
                    }
                    : edge,
            ),
        );

        setEditingEdgeId(null);
    };

    function getSubtitleByBlockConfig(settings: BlockSettingsPayload): string {
        if (settings.config?.condition) {
            const { leftValue, operator, rightValue } = settings.config.condition;

            return `${leftValue} ${operator} ${rightValue}`.trim();
        }

        if (settings.config?.email) {
            return settings.config.email.recipient
                ? `Email: ${settings.config.email.recipient}`
                : settings.subtitle;
        }

        if (settings.config?.database) {
            const { operation, tableName } = settings.config.database;

            return tableName ? `${operation.toUpperCase()}: ${tableName}` : operation.toUpperCase();
        }

        if (settings.config?.log) {
            return `Log: ${settings.config.log.level}`;
        }

        if (settings.config?.action) {
            return `Action: ${settings.config.action.actionType}`;
        }

        if (settings.config?.http) {
            const { method, url } = settings.config.http;

            return url ? `${method} ${url}` : `${method} URL не задан`;
        }

        if (settings.config?.loop) {
            const { collectionPath, itemName, mode } = settings.config.loop;

            return `${mode}: ${collectionPath || 'collection'} as ${itemName || 'item'}`;
        }

        if (settings.config?.merge) {
            return settings.config.merge.mode === 'combine'
                ? 'Merge: объединить результаты'
                : 'Merge: пропустить результат';
        }

        return settings.subtitle;
    }

    const editingEdgeSourceNode = editingEdge
        ? nodes.find((node) => node.id === editingEdge.source)
        : undefined;

    const isEditingConditionEdge = editingEdgeSourceNode?.data.blockType === 'condition';

    const editingConditionBranch = editingEdge
        ? getConditionBranchFromEdge(editingEdge) ?? 'yes'
        : 'yes';

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
                {!readonly &&
                    <MiniMap
                        className="notebook-canvas__minimap"
                        pannable
                        zoomable
                        nodeColor="#d1d5db"
                        nodeStrokeColor="#cbd5e1"
                        maskColor="rgba(248, 247, 243, 0.48)"
                    />
                }
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
                    initialBranch={editingConditionBranch}
                    isConditionEdge={isEditingConditionEdge}
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

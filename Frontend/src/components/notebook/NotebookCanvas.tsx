import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
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
    NotebookBlockStatus,
    NotebookHistoryRequest,
    NotebookHistoryState,
    NotebookNode,
    NotebookSearchRequest,
    NotebookSearchResult,
    NotebookViewportRequest,
} from './notebookTypes';
import type {
    NotebookBlockInspectionTarget,
    NotebookExecutionLog,
    WorkflowExecutionResult,
    WorkflowExecutionStatus,
    WorkflowExecutionTarget,
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
import type {
    BackendJsonObject,
    ExecutionLogResponse,
} from '../../services/workflowApiTypes';
import {
    toNotebookExecutionLog,
    toWorkflowExecutionResult,
} from './executionApiMapper';
import { toBackendWorkflowRequest } from './backendWorkflowMapper';
import {
    mapApiExecutionLogStatus,
    mapApiExecutionStatus,
} from './executionTypes';
import {
    flushNotebookDraftAutosave,
    scheduleNotebookDraftAutosave,
} from '../../services/notebookDraftAutosave';

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
    onExecutionStarted?: (target: WorkflowExecutionTarget) => void;
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
    onBlockInspect?: (block: NotebookBlockInspectionTarget) => void;
    onBlockAutocomplete?: (payload: NotebookPayloadDto, blockId: string) => void;
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

function getInitialPayloadLoadKey(payload: NotebookPayloadDto) {
    const blockStatusesKey = payload.blocks
        .map((block) => `${block.id}:${block.status ?? 'idle'}`)
        .join('|');

    return [
        payload.id ?? 'local',
        payload.serverNotebookId ?? 'local-server',
        payload.workflowId ?? 'local-workflow',
        payload.updatedAt,
        blockStatusesKey,
    ].join('::');
}

function getMissingRuntimeBlockStatus(
    executionStatus: WorkflowExecutionStatus,
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
        executionStatus === 'running' ||
        executionStatus === 'waiting'
    ) {
        return 'pending';
    }

    return 'idle';
}

function canAutocompleteNode(node: NotebookNode, edges: Edge[]) {
    if (node.data.blockType === 'end') {
        return false;
    }

    return !edges.some((edge) => edge.source === node.id);
}

function getRecommendedNodePosition(
    sourceNode: NotebookNode | undefined,
    fallbackPosition: XYPosition,
): XYPosition {
    if (!sourceNode) {
        return fallbackPosition;
    }

    return {
        x: sourceNode.position.x + getApproximateNodeWidth(sourceNode) + 120,
        y: sourceNode.position.y,
    };
}

function createRecommendedEdgeId(sourceBlockId: string, targetBlockId: string) {
    return `edge-${sourceBlockId}-${targetBlockId}-${Date.now()}`;
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
                            onExecutionStarted,
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
                            onBlockInspect,
                            onBlockAutocomplete,
                        }: NotebookCanvasProps) {
    const canvasRef = useRef<HTMLDivElement | null>(null);
    const nodeCounterRef = useRef(initialNodes.length);
    const loadedPayloadKeyRef = useRef<string | null>(null);
    const latestPayloadRef = useRef<NotebookPayloadDto | null>(initialPayload);
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
            const sourceNode = request.sourceBlockId
                ? nodes.find((node) => node.id === request.sourceBlockId)
                : undefined;

            const position = getRecommendedNodePosition(
                sourceNode,
                getCanvasCenterPosition(),
            );

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
                    config: request.proposedConfig,
                },
            };
        },
        [createNodeId, getCanvasCenterPosition, nodes],
    );

    useEffect(() => {
        if (!blockRequest || readonly || !reactFlowInstance) {
            return;
        }

        const newNode = createNodeFromRequest(blockRequest);

        setNodes((currentNodes) => [...currentNodes, newNode]);

        if (blockRequest.sourceBlockId) {
            const sourceNode = nodes.find(
                (node) => node.id === blockRequest.sourceBlockId,
            );

            if (sourceNode?.data.blockType === 'condition') {
                const branch = getAvailableConditionBranchForEdges(
                    blockRequest.sourceBlockId,
                    edges,
                );

                if (!branch) {
                    onExecutionLogsChange?.([
                        createExecutionLog({
                            level: 'warning',
                            status: 'idle',
                            blockId: sourceNode.id,
                            blockTitle: sourceNode.data.title,
                            message:
                                `У блока "${sourceNode.data.title}" уже есть две ветки: ` +
                                `"Да" и "Нет". Блок добавлен, но связь не создана.`,
                        }),
                    ]);

                    onBlockRequestHandled?.(blockRequest.requestId);
                    return;
                }

                setEdges((currentEdges) =>
                    addEdge(
                        {
                            id: createRecommendedEdgeId(
                                blockRequest.sourceBlockId!,
                                newNode.id,
                            ),
                            source: blockRequest.sourceBlockId!,
                            target: newNode.id,
                            sourceHandle: branch,
                            type: 'smoothstep',
                            label: conditionBranchLabels[branch],
                        },
                        currentEdges,
                    ),
                );

                onBlockRequestHandled?.(blockRequest.requestId);
                return;
            }

            setEdges((currentEdges) =>
                addEdge(
                    {
                        id: createRecommendedEdgeId(
                            blockRequest.sourceBlockId!,
                            newNode.id,
                        ),
                        source: blockRequest.sourceBlockId!,
                        target: newNode.id,
                        type: 'smoothstep',
                    },
                    currentEdges,
                ),
            );
        }

        onBlockRequestHandled?.(blockRequest.requestId);
    }, [
        blockRequest,
        createNodeFromRequest,
        edges,
        nodes,
        onBlockRequestHandled,
        onExecutionLogsChange,
        reactFlowInstance,
        readonly,
        setEdges,
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

        const nextPayload = {
            ...payload,
            serverNotebookId: initialPayload?.serverNotebookId,
            workflowId: initialPayload?.workflowId,
            workflowStatus: initialPayload?.workflowStatus,
        };

        latestPayloadRef.current = nextPayload;
        scheduleNotebookDraftAutosave(nextPayload);
        onNotebookChange(nextPayload);
    }, [
        edges,
        nodes,
        notebookId,
        notebookTitle,
        onNotebookChange,
        viewport,
        initialPayload,
    ]);

    useEffect(() => {
        const handleBeforeUnload = () => {
            flushNotebookDraftAutosave(latestPayloadRef.current);
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            flushNotebookDraftAutosave(latestPayloadRef.current);
        };
    }, []);

    useEffect(() => {
        if (!initialPayload) {
            return;
        }

        const payloadKey = getInitialPayloadLoadKey(initialPayload);

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
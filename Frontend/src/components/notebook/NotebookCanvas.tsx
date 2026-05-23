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
import { NotebookClipboardShortcutsBridge } from './useNotebookClipboardShortcuts';
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

const RUN_STEP_DELAY_MS = 550;

function normalizeSearchQuery(query: string) {
    return query.trim().toLowerCase();
}

function getNodeTypeByBlockType(blockType: NotebookNode['data']['blockType']) {
    return blockType === 'ai' ? 'aiBlock' : 'customBlock';
}

function getApproximateNodeWidth(node: NotebookNode) {
    return node.data.blockType === 'ai' ? 380 : 290;
}

function createRecommendedEdgeId(sourceBlockId: string, targetBlockId: string) {
    return `edge-${sourceBlockId}-${targetBlockId}-${Date.now()}`;
}

function getSearchableNodeContent(node: NotebookNode) {
    return [
        node.data.title,
        node.data.subtitle,
        node.data.description,
        node.data.blockType,
        node.data.meta,
        node.data.icon,
        node.data.config ? JSON.stringify(node.data.config) : '',
        node.data.aiConfig ? JSON.stringify(node.data.aiConfig) : '',
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
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

function createNodeFromRequest(params: {
    request: NotebookBlockRequest;
    position: XYPosition;
    id: string;
}): NotebookNode {
    const definition = getBlockDefinition(params.request.blockType);

    if (definition.blockType === 'ai') {
        return {
            id: params.id,
            type: 'aiBlock',
            position: params.position,
            data: {
                title: definition.title,
                subtitle: definition.subtitle,
                description: definition.description,
                icon: definition.icon,
                blockType: 'ai',
                status: 'idle',
                aiConfig: {
                    prompt: '',
                    models: [...defaultAiConfig.models],
                },
                config: params.request.proposedConfig,
            },
        };
    }

    return {
        id: params.id,
        type: getNodeTypeByBlockType(definition.blockType),
        position: params.position,
        data: {
            title: definition.title,
            subtitle: definition.subtitle,
            description: definition.description,
            icon: definition.icon,
            blockType: definition.blockType,
            status: 'idle',
            config: params.request.proposedConfig,
        },
    };
}

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

function canAutocompleteNode(node: NotebookNode, edges: Edge[]) {
    if (node.data.blockType === 'end') {
        return false;
    }

    return !edges.some((edge) => edge.source === node.id);
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
    onExecutionStarted,
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
    onBlockInspect,
    onBlockAutocomplete,
}: NotebookCanvasProps) {
    const canvasRef = useRef<HTMLDivElement | null>(null);
    const nodeCounterRef = useRef(initialNodes.length);
    const loadedPayloadKeyRef = useRef<string | null>(null);
    const latestPayloadRef = useRef<NotebookPayloadDto | null>(initialPayload);
    const isWorkflowRunningRef = useRef(false);
    const historyStateRef = useRef<NotebookHistoryStorageState | null>(null);
    const shouldSkipNextHistoryRecordRef = useRef(false);

    const [reactFlowInstance, setReactFlowInstance] =
        useState<ReactFlowInstance<NotebookNode, Edge> | null>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState<NotebookNode>(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [viewport, setViewport] = useState<Viewport | undefined>(undefined);
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
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
    const editingEdgeSourceNode = editingEdge
        ? nodes.find((node) => node.id === editingEdge.source)
        : undefined;
    const isEditingConditionEdge = editingEdgeSourceNode?.data.blockType === 'condition';
    const editingConditionBranch = editingEdge
        ? getConditionBranchFromEdge(editingEdge) ?? 'yes'
        : 'yes';

    const buildCurrentPayload = useCallback((): NotebookPayloadDto => {
        const payload = toNotebookPayload({
            notebookId,
            title: notebookTitle,
            nodes,
            edges,
            viewport,
        });

        return {
            ...payload,
            serverNotebookId: initialPayload?.serverNotebookId,
            workflowId: initialPayload?.workflowId,
            workflowStatus: initialPayload?.workflowStatus,
        };
    }, [
        edges,
        initialPayload?.serverNotebookId,
        initialPayload?.workflowId,
        initialPayload?.workflowStatus,
        nodes,
        notebookId,
        notebookTitle,
        viewport,
    ]);

    const getCanvasCenterPosition = useCallback((): XYPosition => {
        const rect = canvasRef.current?.getBoundingClientRect();

        if (!rect || !reactFlowInstance) {
            return { x: 120, y: 120 };
        }

        const offset = (nodeCounterRef.current % 6) * 24;

        return reactFlowInstance.screenToFlowPosition({
            x: rect.left + rect.width / 2 + offset,
            y: rect.top + rect.height / 2 + offset,
        });
    }, [reactFlowInstance]);

    const createNodeId = useCallback((prefix: string) => {
        nodeCounterRef.current += 1;
        return `${prefix}-${nodeCounterRef.current}`;
    }, []);

    useEffect(() => {
        const payload = buildCurrentPayload();

        latestPayloadRef.current = payload;
        scheduleNotebookDraftAutosave(payload);
        onNotebookChange?.(payload);
    }, [buildCurrentPayload, onNotebookChange]);

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

        const payloadKey = [
            initialPayload.id,
            initialPayload.serverNotebookId,
            initialPayload.workflowId,
            initialPayload.updatedAt,
        ].join(':');

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
    }, [
        initialPayload,
        reactFlowInstance,
        setEdges,
        setNodes,
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
        if (!blockRequest || readonly || !reactFlowInstance) {
            return;
        }

        const sourceNode = blockRequest.sourceBlockId
            ? nodes.find((node) => node.id === blockRequest.sourceBlockId)
            : undefined;
        const position = sourceNode
            ? {
                x: sourceNode.position.x + getApproximateNodeWidth(sourceNode) + 120,
                y: sourceNode.position.y,
            }
            : getCanvasCenterPosition();
        const definition = getBlockDefinition(blockRequest.blockType);
        const newNode = createNodeFromRequest({
            request: blockRequest,
            position,
            id: createNodeId(definition.blockType),
        });

        setNodes((currentNodes) => [...currentNodes, newNode]);

        if (blockRequest.sourceBlockId) {
            const sourceBlockId = blockRequest.sourceBlockId;

            if (sourceNode?.data.blockType === 'condition') {
                const branch = getAvailableConditionBranchForEdges(sourceBlockId, edges);

                if (!branch) {
                    onBlockRequestHandled?.(blockRequest.requestId);
                    return;
                }

                setEdges((currentEdges) => addEdge({
                    id: createRecommendedEdgeId(sourceBlockId, newNode.id),
                    source: sourceBlockId,
                    target: newNode.id,
                    sourceHandle: branch,
                    type: 'smoothstep',
                    label: conditionBranchLabels[branch],
                }, currentEdges));
            } else {
                setEdges((currentEdges) => addEdge({
                    id: createRecommendedEdgeId(sourceBlockId, newNode.id),
                    source: sourceBlockId,
                    target: newNode.id,
                    type: 'smoothstep',
                }, currentEdges));
            }
        }

        onBlockRequestHandled?.(blockRequest.requestId);
    }, [
        blockRequest,
        createNodeId,
        edges,
        getCanvasCenterPosition,
        nodes,
        onBlockRequestHandled,
        reactFlowInstance,
        readonly,
        setEdges,
        setNodes,
    ]);

    useEffect(() => {
        if (!autoLayoutRequest || readonly) {
            if (autoLayoutRequest) {
                onAutoLayoutRequestHandled?.(autoLayoutRequest.requestId);
            }
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
            reactFlowInstance?.fitView({ padding: 0.18 });
        });

        onExecutionLogsChange?.([
            createExecutionLog({
                level: 'info',
                status: 'idle',
                message:
                    `Автосборка схемы завершена. Создано блоков: ${result.createdNodesCount}. ` +
                    `Перемещено блоков: ${result.movedNodesCount}. Добавлено связей: ${result.createdEdgesCount}.`,
            }),
        ]);
        onExecutionStatusChange?.('idle');
        onAutoLayoutRequestHandled?.(autoLayoutRequest.requestId);
    }, [
        autoLayoutRequest,
        edges,
        nodes,
        onAutoLayoutRequestHandled,
        onExecutionLogsChange,
        onExecutionStatusChange,
        reactFlowInstance,
        readonly,
        setEdges,
        setNodes,
    ]);

    useEffect(() => {
        if (!viewportRequest || !reactFlowInstance) {
            return undefined;
        }

        const animationFrameId = window.requestAnimationFrame(() => {
            if (viewportRequest.mode === 'fit') {
                void reactFlowInstance.fitView({ padding: 0.18 });
                onViewportRequestHandled?.(viewportRequest.requestId);
                return;
            }

            const nextViewport = {
                ...reactFlowInstance.getViewport(),
                zoom: viewportRequest.zoom,
            };

            void reactFlowInstance.setViewport(nextViewport);
            setViewport(nextViewport);
            onViewportRequestHandled?.(viewportRequest.requestId);
        });

        return () => {
            window.cancelAnimationFrame(animationFrameId);
        };
    }, [onViewportRequestHandled, reactFlowInstance, viewportRequest]);

    useEffect(() => {
        if (!searchRequest || !reactFlowInstance) {
            return;
        }

        const normalizedQuery = normalizeSearchQuery(searchRequest.query);

        if (!normalizedQuery) {
            setNodes((currentNodes) => currentNodes.map((node) => ({
                ...node,
                selected: false,
            })));
            onSearchRequestHandled?.({
                requestId: searchRequest.requestId,
                query: searchRequest.query,
                found: false,
                total: 0,
            });
            return;
        }

        const matchedNodes = nodes.filter((node) =>
            getSearchableNodeContent(node).includes(normalizedQuery),
        );
        const matchedNode = matchedNodes[0];

        setNodes((currentNodes) => currentNodes.map((node) => ({
            ...node,
            selected: matchedNode ? node.id === matchedNode.id : false,
        })));

        if (matchedNode) {
            void reactFlowInstance.setCenter(
                matchedNode.position.x + getApproximateNodeWidth(matchedNode) / 2,
                matchedNode.position.y + 90,
                { zoom: Math.max(reactFlowInstance.getViewport().zoom, 0.9), duration: 450 },
            );
        }

        onSearchRequestHandled?.({
            requestId: searchRequest.requestId,
            query: searchRequest.query,
            found: Boolean(matchedNode),
            total: matchedNodes.length,
            activeIndex: matchedNode ? 0 : undefined,
            matchedNodeId: matchedNode?.id,
            matchedTitle: matchedNode?.data.title,
        });
    }, [nodes, onSearchRequestHandled, reactFlowInstance, searchRequest, setNodes]);

    const onConnect = useCallback(
        (connection: Connection) => {
            if (readonly || !connection.source || !connection.target) {
                return;
            }

            const sourceNode = nodes.find((node) => node.id === connection.source);

            if (sourceNode?.data.blockType === 'condition') {
                const branch = getAvailableConditionBranchForEdges(connection.source, edges);

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

                setEdges((currentEdges) => addEdge({
                    ...connection,
                    sourceHandle: branch,
                    type: 'smoothstep',
                    label: conditionBranchLabels[branch],
                }, currentEdges));
                return;
            }

            setEdges((currentEdges) => addEdge({
                ...connection,
                type: 'smoothstep',
            }, currentEdges));
        },
        [edges, nodes, onExecutionLogsChange, readonly, setEdges],
    );

    const handleEditNode = useCallback((nodeId: string) => {
        setEditingNodeId(nodeId);
    }, []);

    const handleDeleteNode = useCallback(
        (nodeId: string) => {
            if (readonly) {
                return;
            }

            setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId));
            setEdges((currentEdges) =>
                currentEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
            );
            setEditingNodeId((currentEditingNodeId) =>
                currentEditingNodeId === nodeId ? null : currentEditingNodeId,
            );
        },
        [readonly, setEdges, setNodes],
    );

    const handleAutocompleteNode = useCallback(
        (nodeId: string) => {
            if (readonly) {
                return;
            }

            onBlockAutocomplete?.(buildCurrentPayload(), nodeId);
        },
        [buildCurrentPayload, onBlockAutocomplete, readonly],
    );

    const handleNodeClick = useCallback(
        (_event: MouseEvent, node: NotebookNode) => {
            onBlockInspect?.({
                blockId: node.id,
                blockTitle: node.data.title,
                blockType: node.data.blockType,
                blockStatus: node.data.status ?? 'idle',
            });
        },
        [onBlockInspect],
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

            setNodes((currentNodes) => currentNodes.map((node) =>
                node.id === nodeId
                    ? { ...node, data: { ...node.data, status: 'running' } }
                    : node,
            ));

            window.setTimeout(() => {
                setNodes((currentNodes) => currentNodes.map((node) =>
                    node.id === nodeId
                        ? { ...node, data: { ...node.data, status: 'success' } }
                        : node,
                ));
                onExecutionStatusChange?.('success');
                onExecutionLogsChange?.([
                    createExecutionLog({
                        level: 'success',
                        status: 'success',
                        blockId: nodeId,
                        blockTitle: runningNode?.data.title,
                        message: 'Отдельный блок успешно выполнен.',
                    }),
                ]);
            }, 900);
        },
        [nodes, onExecutionLogsChange, onExecutionStatusChange, setNodes],
    );

    const handleRunWorkflow = useCallback(
        async (request: WorkflowRunRequest) => {
            if (isWorkflowRunningRef.current) {
                onRunRequestHandled?.(request.requestId);
                return;
            }

            isWorkflowRunningRef.current = true;
            const startedAt = new Date();
            const executionLogs: NotebookExecutionLog[] = [];

            const pushLog = (log: NotebookExecutionLog) => {
                executionLogs.push(log);
                onExecutionLogsChange?.([...executionLogs]);
            };

            try {
                onExecutionStarted?.(request.serverNotebookId && request.workflowId
                    ? {
                        serverNotebookId: request.serverNotebookId,
                        workflowId: request.workflowId,
                    }
                    : { serverNotebookId: '', workflowId: '' });
                onExecutionResultChange?.(null);
                onExecutionStatusChange?.('running');
                onExecutionLogsChange?.([]);

                const validationIssues = validateWorkflow(nodes, edges);
                const validationErrors = validationIssues.filter((issue) => issue.severity === 'error');

                validationIssues.forEach((issue) => {
                    pushLog(createExecutionLog({
                        level: issue.severity,
                        status: issue.severity === 'error' ? 'error' : 'running',
                        blockId: issue.blockId,
                        blockTitle: issue.blockTitle,
                        message: issue.message,
                    }));
                });

                if (validationErrors.length > 0) {
                    onExecutionStatusChange?.('error');
                    onExecutionResultChange?.({
                        id: `${Date.now()}-validation-error`,
                        status: 'error',
                        startedAt: startedAt.toISOString(),
                        finishedAt: new Date().toISOString(),
                        durationMs: 0,
                        totalBlocks: nodes.length,
                        completedBlocks: 0,
                        failedBlocks: validationErrors.length,
                        warningsCount: validationIssues.length - validationErrors.length,
                        errorsCount: validationErrors.length,
                        summary: 'Схема не готова к запуску',
                        output: validationErrors[0]?.message ?? 'Схема содержит ошибки.',
                        outputFormat: 'text',
                        rawOutput: JSON.stringify(validationIssues, null, 2),
                    });
                    return;
                }

                const executionPlan = getWorkflowExecutionPlan(nodes, edges);
                const executionOrder = executionPlan.orderedNodes;
                const skippedNodeIds = executionPlan.skippedNodeIds;
                let completedBlocks = 0;

                setNodes((currentNodes) => currentNodes.map((node) => ({
                    ...node,
                    data: {
                        ...node.data,
                        status: skippedNodeIds.has(node.id) ? 'skipped' : 'pending',
                    },
                })));

                for (const node of executionOrder) {
                    if (skippedNodeIds.has(node.id)) {
                        continue;
                    }

                    pushLog(createExecutionLog({
                        level: 'info',
                        status: 'running',
                        blockId: node.id,
                        blockTitle: node.data.title,
                        message: `Блок "${node.data.title}" начал выполнение.`,
                    }));

                    setNodes((currentNodes) => currentNodes.map((currentNode) =>
                        currentNode.id === node.id
                            ? { ...currentNode, data: { ...currentNode.data, status: 'running' } }
                            : currentNode,
                    ));

                    await sleep(node.data.blockType === 'ai' ? 1000 : RUN_STEP_DELAY_MS);

                    setNodes((currentNodes) => currentNodes.map((currentNode) =>
                        currentNode.id === node.id
                            ? { ...currentNode, data: { ...currentNode.data, status: 'success' } }
                            : currentNode,
                    ));

                    completedBlocks += 1;
                    pushLog(createExecutionLog({
                        level: 'success',
                        status: 'success',
                        blockId: node.id,
                        blockTitle: node.data.title,
                        message: `Блок "${node.data.title}" успешно выполнен.`,
                    }));
                }

                const finishedAt = new Date();

                onExecutionStatusChange?.('success');
                onExecutionResultChange?.({
                    id: `${finishedAt.getTime()}-success`,
                    status: 'success',
                    startedAt: startedAt.toISOString(),
                    finishedAt: finishedAt.toISOString(),
                    durationMs: finishedAt.getTime() - startedAt.getTime(),
                    totalBlocks: executionOrder.length,
                    completedBlocks,
                    failedBlocks: 0,
                    warningsCount: skippedNodeIds.size,
                    errorsCount: 0,
                    summary: 'Рабочий процесс успешно завершён',
                    output: `Выполнено блоков: ${completedBlocks} из ${executionOrder.length}.`,
                    outputFormat: 'text',
                });
            } catch (error) {
                const finishedAt = new Date();

                onExecutionStatusChange?.('error');
                pushLog(createExecutionLog({
                    level: 'error',
                    status: 'error',
                    message: error instanceof Error
                        ? error.message
                        : 'Во время выполнения рабочего процесса произошла ошибка.',
                }));
                onExecutionResultChange?.({
                    id: `${finishedAt.getTime()}-runtime-error`,
                    status: 'error',
                    startedAt: startedAt.toISOString(),
                    finishedAt: finishedAt.toISOString(),
                    durationMs: finishedAt.getTime() - startedAt.getTime(),
                    totalBlocks: nodes.length,
                    completedBlocks: 0,
                    failedBlocks: 1,
                    warningsCount: 0,
                    errorsCount: 1,
                    summary: 'Рабочий процесс завершился с ошибкой',
                    output: error instanceof Error ? error.message : 'Неизвестная ошибка.',
                    outputFormat: 'text',
                });
            } finally {
                isWorkflowRunningRef.current = false;
                onRunRequestHandled?.(request.requestId);
            }
        },
        [
            edges,
            nodes,
            onExecutionLogsChange,
            onExecutionResultChange,
            onExecutionStarted,
            onExecutionStatusChange,
            onRunRequestHandled,
            setNodes,
        ],
    );

    useEffect(() => {
        if (!runRequest) {
            return;
        }

        void handleRunWorkflow(runRequest);
    }, [handleRunWorkflow, runRequest]);

    const nodesWithHandlers = useMemo(
        () => nodes.map((node) => ({
            ...node,
            data: {
                ...node.data,
                canAutocomplete: !readonly && canAutocompleteNode(node, edges),
                onRun: handleRunNode,
                onEdit: handleEditNode,
                onDelete: handleDeleteNode,
                onAutocomplete: handleAutocompleteNode,
            },
        })),
        [
            edges,
            handleAutocompleteNode,
            handleDeleteNode,
            handleEditNode,
            handleRunNode,
            nodes,
            readonly,
        ],
    );

    const handleSaveAiBlock = (title: string, config: AiBlockConfig) => {
        if (!editingNodeId) {
            return;
        }

        setNodes((currentNodes) => currentNodes.map((node) =>
            node.id === editingNodeId
                ? { ...node, data: { ...node.data, title, aiConfig: config } }
                : node,
        ));
        setEditingNodeId(null);
    };

    const handleSaveGenericBlock = (settings: BlockSettingsPayload) => {
        if (!editingNodeId) {
            return;
        }

        setNodes((currentNodes) => currentNodes.map((node) =>
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
        ));
        setEditingNodeId(null);
    };

    const handleSaveEdgeLabel = (label: string, branch?: 'yes' | 'no') => {
        if (!editingEdgeId) {
            return;
        }

        setEdges((currentEdges) => currentEdges.map((edge) =>
            edge.id === editingEdgeId
                ? {
                    ...edge,
                    label: branch ? conditionBranchLabels[branch] : label || undefined,
                    sourceHandle: branch ?? edge.sourceHandle,
                }
                : edge,
        ));
        setEditingEdgeId(null);
    };

    return (
        <div className="notebook-canvas" ref={canvasRef}>
            <ReactFlow<NotebookNode, Edge>
                nodes={nodesWithHandlers}
                edges={edges}
                nodeTypes={nodeTypes}
                onInit={setReactFlowInstance}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={handleNodeClick}
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
                <NotebookClipboardShortcutsBridge
                    readonly={readonly}
                    setNodes={setNodes}
                    setEdges={setEdges}
                />
                
                <Background />
                <Controls />
                {!readonly && (
                    <MiniMap
                        className="notebook-canvas__minimap"
                        pannable
                        zoomable
                        nodeColor="#d1d5db"
                        nodeStrokeColor="#cbd5e1"
                        maskColor="rgba(248, 247, 243, 0.48)"
                    />
                )}
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

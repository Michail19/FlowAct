import { useCallback, useMemo, useState } from 'react';
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
} from '@xyflow/react';

import AiBlockModal from './AiBlockModal';
import AiBlockNode from './AiBlockNode';
import CustomBlockNode from './CustomBlockNode';
import BlockSettingsModal from "./BlockSettingsModal";
import { DEFAULT_AI_MODEL_ID } from './aiModels';
import type { AiBlockConfig, NotebookNode } from './notebookTypes';

import '@xyflow/react/dist/style.css';
import './NotebookCanvas.css';

type NotebookCanvasProps = {
    readonly?: boolean;
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
            icon: '▶',
            blockType: 'start',
            status: 'success',
        },
    },
    {
        id: 'ai-main',
        type: 'aiBlock',
        position: { x: 360, y: 160 },
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
        position: { x: 720, y: 180 },
        data: {
            title: 'Проверка результата',
            subtitle: 'Если ответ корректный',
            icon: '◇',
            blockType: 'condition',
            status: 'idle',
        },
    },
    {
        id: 'database-save',
        type: 'customBlock',
        position: { x: 1080, y: 70 },
        data: {
            title: 'Сохранить в БД',
            subtitle: 'Запись результата выполнения',
            icon: 'DB',
            blockType: 'database',
            status: 'idle',
        },
    },
    {
        id: 'email-send',
        type: 'customBlock',
        position: { x: 1370, y: 70 },
        data: {
            title: 'Отправить Email',
            subtitle: 'Уведомить пользователя',
            icon: '✉',
            blockType: 'email',
            status: 'idle',
        },
    },
    {
        id: 'ai-retry',
        type: 'aiBlock',
        position: { x: 1080, y: 330 },
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
        position: { x: 1370, y: 330 },
        data: {
            title: 'Форматирование',
            subtitle: 'Подготовка результата',
            icon: '▰',
            blockType: 'action',
            status: 'idle',
        },
    },
    {
        id: 'log-result',
        type: 'customBlock',
        position: { x: 1660, y: 200 },
        data: {
            title: 'Логирование',
            subtitle: 'Сохранение истории выполнения',
            icon: 'LOG',
            blockType: 'log',
            status: 'idle',
        },
    },
    {
        id: 'end',
        type: 'customBlock',
        position: { x: 1950, y: 200 },
        data: {
            title: 'Конец',
            subtitle: 'Рабочий процесс завершён',
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

function NotebookCanvas({ readonly = false }: NotebookCanvasProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState<NotebookNode>(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

    const nodeTypes = useMemo<NodeTypes>(
        () => ({
            aiBlock: AiBlockNode,
            customBlock: CustomBlockNode,
        }),
        [],
    );

    const editingNode = nodes.find((node) => node.id === editingNodeId);
    const editingConfig = editingNode?.data.aiConfig ?? defaultAiConfig;

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
        },
        [readonly, setEdges, setNodes],
    );

    const handleRunNode = useCallback(
        (nodeId: string) => {
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
            }, 900);
        },
        [setNodes],
    );

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
        <div className="notebook-canvas">
            <ReactFlow
                nodes={visibleNodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
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

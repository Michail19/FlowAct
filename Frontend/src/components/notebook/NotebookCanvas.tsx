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

    const handleNodeClick = useCallback(
        (event: React.MouseEvent, node: NotebookNode) => {
            const target = event.target as HTMLElement;
            const actionElement = target.closest<HTMLElement>('[data-node-action]');
            const action = actionElement?.dataset.nodeAction;

            if (!action) {
                return;
            }

            event.stopPropagation();

            if (action === 'edit' && node.data.blockType === 'ai') {
                setEditingNodeId(node.id);
                return;
            }

            if (action === 'delete' && !readonly) {
                setNodes((currentNodes) =>
                    currentNodes.filter((currentNode) => currentNode.id !== node.id),
                );

                setEdges((currentEdges) =>
                    currentEdges.filter((edge) => edge.source !== node.id && edge.target !== node.id),
                );

                return;
            }

            if (action === 'run') {
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

                window.setTimeout(() => {
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
                }, 900);
            }
        },
        [readonly, setEdges, setNodes],
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

    return (
        <div className="notebook-canvas">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={handleNodeClick}
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
        </div>
    );
}

export default NotebookCanvas;

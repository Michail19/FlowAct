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
import type { AiBlockConfig, NotebookNode } from './notebookTypes';

import '@xyflow/react/dist/style.css';
import './NotebookCanvas.css';

type NotebookCanvasProps = {
    readonly?: boolean;
};

const defaultAiConfig: AiBlockConfig = {
    prompt: '',
    model: 'Chat-gpt-4o',
    additionalModel: '',
    meta: '<Краткая мета-информация>',
};

const initialNodes: NotebookNode[] = [
    {
        id: 'ai-1',
        type: 'aiBlock',
        position: { x: 120, y: 120 },
        data: {
            title: 'AI-функция',
            blockType: 'ai',
            status: 'idle',
            aiConfig: defaultAiConfig,
        },
    },
];

const initialEdges: Edge[] = [];

function NotebookCanvas({ readonly = false }: NotebookCanvasProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState<NotebookNode>(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

    const nodeTypes = useMemo<NodeTypes>(
        () => ({
            aiBlock: AiBlockNode,
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

            if (action === 'edit') {
                setEditingNodeId(node.id);
                return;
            }

            if (action === 'delete' && !readonly) {
                setNodes((currentNodes) => currentNodes.filter((currentNode) => currentNode.id !== node.id));
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

    const handleSaveAiConfig = (config: AiBlockConfig) => {
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
                            aiConfig: config,
                            meta: config.meta,
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

            {editingNode && (
                <AiBlockModal
                    initialConfig={editingConfig}
                    onSave={handleSaveAiConfig}
                    onClose={() => setEditingNodeId(null)}
                />
            )}
        </div>
    );
}

export default NotebookCanvas;

import { useCallback } from 'react';
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
    type Node,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';
import './NotebookCanvas.css';

type NotebookCanvasProps = {
    readonly?: boolean;
};

const initialNodes: Node[] = [
    {
        id: 'start',
        type: 'input',
        position: { x: 120, y: 120 },
        data: { label: 'Старт' },
    },
    {
        id: 'end',
        type: 'output',
        position: { x: 520, y: 120 },
        data: { label: 'Конец' },
    },
];

const initialEdges: Edge[] = [];

function NotebookCanvas({ readonly = false }: NotebookCanvasProps) {
    const [nodes, , onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    const onConnect = useCallback(
        (connection: Connection) => {
            if (readonly) {
                return;
            }

            setEdges((currentEdges) => addEdge(connection, currentEdges));
        },
        [readonly, setEdges],
    );

    return (
        <div className="notebook-canvas">
            <ReactFlow
                nodes={nodes}
                edges={edges}
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
        </div>
    );
}

export default NotebookCanvas;

import { useCallback } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    addEdge,
    useEdgesState,
    useNodesState,
    type Connection,
    type Edge,
    type Node,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';
import './FlowCanvas.css';

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

function FlowCanvas() {
    const [nodes, , onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    const onConnect = useCallback(
        (connection: Connection) => {
            setEdges((currentEdges) => addEdge(connection, currentEdges));
        },
        [setEdges],
    );

    return (
        <section className="flow-canvas">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
            >
                <Background />
                <Controls />
            </ReactFlow>
        </section>
    );
}

export default FlowCanvas;

import { useCallback } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    addEdge,
    useEdgesState,
    useNodesState,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';
import './FlowCanvas.css';

const initialNodes = [
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

const initialEdges = [];

function FlowCanvas() {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    const onConnect = useCallback(
        (connection) => {
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

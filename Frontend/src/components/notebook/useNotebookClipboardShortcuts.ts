import { useEffect, useRef } from 'react';
import {
    useReactFlow,
    type Edge,
    type Node,
} from '@xyflow/react';

import type { NotebookNode } from './notebookTypes';
import {
    isCopyShortcut,
    isCutShortcut,
    isPasteShortcut,
    shouldIgnoreCanvasShortcut,
    stopNotebookShortcutEvent,
} from './keyboardShortcutUtils';

type ClipboardNode = Pick<NotebookNode, 'id' | 'type' | 'position' | 'data'>;
type ClipboardEdge = Edge;

type NotebookClipboardData = {
    nodes: ClipboardNode[];
    edges: ClipboardEdge[];
    copiedAt: number;
};

type NotebookStateUpdater<T> = (updater: (currentValue: T[]) => T[]) => void;

type NotebookClipboardShortcutOptions = {
    readonly: boolean;
    setNodes: NotebookStateUpdater<NotebookNode>;
    setEdges: NotebookStateUpdater<Edge>;
};

const PASTE_OFFSET = 48;
const CLIPBOARD_STORAGE_KEY = 'flowact-notebook-clipboard';

let memoryClipboard: NotebookClipboardData | null = null;
let clipboardShortcutRegistrationCounter = 0;
let activeClipboardShortcutRegistrationId = 0;

function cloneValue<T>(value: T): T {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value)) as T;
}

function sanitizeNodeData(node: NotebookNode): ClipboardNode['data'] {
    const serializableData = cloneValue(node.data);

    delete serializableData.onRun;
    delete serializableData.onEdit;
    delete serializableData.onDelete;
    delete serializableData.onAutocomplete;
    delete serializableData.canAutocomplete;

    return serializableData;
}

function buildClipboardData(nodes: NotebookNode[], edges: Edge[]): NotebookClipboardData | null {
    const selectedNodes = nodes.filter((node) => node.selected);

    if (selectedNodes.length === 0) {
        return null;
    }

    const selectedNodeIds = new Set(selectedNodes.map((node) => node.id));
    const selectedEdges = edges.filter(
        (edge) => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target),
    );

    return {
        nodes: selectedNodes.map((node) => ({
            id: node.id,
            type: node.type,
            position: cloneValue(node.position),
            data: sanitizeNodeData(node),
        })),
        edges: cloneValue(selectedEdges),
        copiedAt: Date.now(),
    };
}

function saveClipboardData(data: NotebookClipboardData) {
    memoryClipboard = data;

    try {
        localStorage.setItem(CLIPBOARD_STORAGE_KEY, JSON.stringify(data));
    } catch {
        // Browser storage is best-effort only. The in-memory clipboard still works.
    }
}

function readClipboardData() {
    if (memoryClipboard) {
        return memoryClipboard;
    }

    try {
        const storedClipboard = localStorage.getItem(CLIPBOARD_STORAGE_KEY);

        if (!storedClipboard) {
            return null;
        }

        const parsedClipboard = JSON.parse(storedClipboard) as NotebookClipboardData;

        if (!Array.isArray(parsedClipboard.nodes) || parsedClipboard.nodes.length === 0) {
            return null;
        }

        memoryClipboard = parsedClipboard;
        return parsedClipboard;
    } catch {
        return null;
    }
}

function getNextCopyIndex(nodes: Node[]) {
    return nodes.reduce((maxIndex, node) => {
        const match = /-copy-(\d+)$/.exec(node.id);

        if (!match) {
            return maxIndex;
        }

        return Math.max(maxIndex, Number(match[1]));
    }, 0) + 1;
}

function createPastedElements(params: {
    clipboard: NotebookClipboardData;
    copyIndex: number;
}) {
    const idMap = new Map<string, string>();
    const offset = PASTE_OFFSET * params.copyIndex;

    const pastedNodes: NotebookNode[] = params.clipboard.nodes.map((node) => {
        const nextId = `${node.id}-copy-${params.copyIndex}`;

        idMap.set(node.id, nextId);

        return {
            ...cloneValue(node),
            id: nextId,
            selected: true,
            position: {
                x: node.position.x + offset,
                y: node.position.y + offset,
            },
            data: {
                ...cloneValue(node.data),
                status: 'idle',
            },
        } as NotebookNode;
    });

    const pastedEdges = params.clipboard.edges.reduce<Edge[]>((result, edge) => {
        const source = idMap.get(edge.source);
        const target = idMap.get(edge.target);

        if (!source || !target) {
            return result;
        }

        result.push({
            ...cloneValue(edge),
            id: `${edge.id}-copy-${params.copyIndex}`,
            source,
            target,
            selected: false,
        });

        return result;
    }, []);

    return {
        pastedNodes,
        pastedEdges,
    };
}

function useNotebookClipboardShortcuts({
    readonly,
    setNodes,
    setEdges,
}: NotebookClipboardShortcutOptions) {
    const reactFlow = useReactFlow<NotebookNode, Edge>();
    const reactFlowRef = useRef(reactFlow);
    const registrationIdRef = useRef(0);

    useEffect(() => {
        reactFlowRef.current = reactFlow;
    }, [reactFlow]);

    useEffect(() => {
        clipboardShortcutRegistrationCounter += 1;
        const registrationId = clipboardShortcutRegistrationCounter;

        registrationIdRef.current = registrationId;
        activeClipboardShortcutRegistrationId = registrationId;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (registrationIdRef.current !== activeClipboardShortcutRegistrationId) {
                return;
            }

            if (readonly || shouldIgnoreCanvasShortcut(event)) {
                return;
            }

            if (!isCopyShortcut(event) && !isCutShortcut(event) && !isPasteShortcut(event)) {
                return;
            }

            stopNotebookShortcutEvent(event);

            const instance = reactFlowRef.current;

            if (isCopyShortcut(event) || isCutShortcut(event)) {
                const clipboard = buildClipboardData(
                    instance.getNodes() as NotebookNode[],
                    instance.getEdges(),
                );

                if (!clipboard) {
                    return;
                }

                saveClipboardData(clipboard);

                if (isCutShortcut(event)) {
                    const cutNodeIds = new Set(clipboard.nodes.map((node) => node.id));

                    setNodes((currentNodes) =>
                        currentNodes.filter((node) => !cutNodeIds.has(node.id)),
                    );
                    setEdges((currentEdges) =>
                        currentEdges.filter(
                            (edge) =>
                                !cutNodeIds.has(edge.source) &&
                                !cutNodeIds.has(edge.target),
                        ),
                    );
                }

                return;
            }

            const clipboard = readClipboardData();

            if (!clipboard) {
                return;
            }

            const copyIndex = getNextCopyIndex(instance.getNodes());
            const { pastedNodes, pastedEdges } = createPastedElements({
                clipboard,
                copyIndex,
            });

            setNodes((currentNodes) => [
                ...currentNodes.map((node) => ({
                    ...node,
                    selected: false,
                })),
                ...pastedNodes,
            ]);
            setEdges((currentEdges) => [
                ...currentEdges.map((edge) => ({
                    ...edge,
                    selected: false,
                })),
                ...pastedEdges,
            ]);
        };

        window.addEventListener('keydown', handleKeyDown, { capture: true });

        return () => {
            window.removeEventListener('keydown', handleKeyDown, { capture: true });

            if (activeClipboardShortcutRegistrationId === registrationId) {
                activeClipboardShortcutRegistrationId = 0;
            }
        };
    }, [readonly, setEdges, setNodes]);
}

export function NotebookClipboardShortcutsBridge(
    props: NotebookClipboardShortcutOptions,
) {
    useNotebookClipboardShortcuts(props);

    return null;
}

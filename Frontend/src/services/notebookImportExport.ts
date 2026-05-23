import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    Background,
    ReactFlow,
    ReactFlowProvider,
    type Edge,
    type NodeTypes,
} from '@xyflow/react';

import AiBlockNode from '../components/notebook/AiBlockNode';
import CustomBlockNode from '../components/notebook/CustomBlockNode';
import { fromNotebookPayload } from '../components/notebook/notebookMapper';
import type {
    NotebookBlockDto,
    NotebookConnectionDto,
    NotebookPayloadDto,
} from '../components/notebook/notebookBackendTypes';
import type { NotebookNode } from '../components/notebook/notebookTypes';
import { saveNotebookLocally } from './notebookStorage';

import '@xyflow/react/dist/style.css';

const EXPORT_SCHEMA = 'flowact.notebook.export';
const EXPORT_VERSION = 1;
const PNG_WIDTH = 1600;
const PNG_HEIGHT = 1000;
const RENDER_WAIT_MS = 260;
const GRID_GAP = 18;

type NotebookExportPayload = {
    schema: typeof EXPORT_SCHEMA;
    exportVersion: typeof EXPORT_VERSION;
    exportedAt: string;
    notebook: NotebookPayloadDto;
};

type CanvasRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

const exportNodeTypes: NodeTypes = {
    customBlock: CustomBlockNode,
    aiBlock: AiBlockNode,
};

function sanitizeFileName(value: string) {
    return (value || 'notebook')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, '-')
        .slice(0, 80) || 'notebook';
}

function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function clonePayloadForExport(payload: NotebookPayloadDto): NotebookPayloadDto {
    return {
        id: payload.id,
        title: payload.title || 'Без названия',
        version: payload.version || 1,
        blocks: payload.blocks.map((block) => ({ ...block })),
        connections: payload.connections.map((connection) => ({ ...connection })),
        viewport: payload.viewport ? { ...payload.viewport } : undefined,
        updatedAt: payload.updatedAt || new Date().toISOString(),
        workflowStatus: payload.workflowStatus,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isValidBlock(value: unknown): value is NotebookBlockDto {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.type !== 'string') {
        return false;
    }

    return (
        typeof value.title === 'string' &&
        isRecord(value.position) &&
        typeof value.position.x === 'number' &&
        typeof value.position.y === 'number'
    );
}

function isValidConnection(value: unknown): value is NotebookConnectionDto {
    return (
        isRecord(value) &&
        typeof value.id === 'string' &&
        typeof value.sourceBlockId === 'string' &&
        typeof value.targetBlockId === 'string'
    );
}

function readNotebookFromUnknown(value: unknown): NotebookPayloadDto {
    const source = isRecord(value) && isRecord(value.notebook)
        ? value.notebook
        : value;

    if (!isRecord(source)) {
        throw new Error('Файл не похож на экспорт FlowAct notebook.');
    }

    const blocks = Array.isArray(source.blocks) ? source.blocks : [];
    const connections = Array.isArray(source.connections) ? source.connections : [];

    if (!blocks.every(isValidBlock)) {
        throw new Error('В JSON есть некорректные блоки notebook.');
    }

    if (!connections.every(isValidConnection)) {
        throw new Error('В JSON есть некорректные связи notebook.');
    }

    return {
        id: crypto.randomUUID(),
        title: typeof source.title === 'string' && source.title.trim()
            ? `${source.title.trim()} (импорт)`
            : 'Импортированный notebook',
        version: typeof source.version === 'number' ? source.version : 1,
        blocks: blocks.map((block) => ({
            ...block,
            status: 'idle',
        })),
        connections: connections.map((connection) => ({ ...connection })),
        viewport: isRecord(source.viewport)
            ? {
                x: typeof source.viewport.x === 'number' ? source.viewport.x : 0,
                y: typeof source.viewport.y === 'number' ? source.viewport.y : 0,
                zoom: typeof source.viewport.zoom === 'number' ? source.viewport.zoom : 1,
            }
            : undefined,
        updatedAt: new Date().toISOString(),
    };
}

function waitForReactFlowRender() {
    return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                window.setTimeout(resolve, RENDER_WAIT_MS);
            });
        });
    });
}

function createOffscreenContainer() {
    const host = document.createElement('div');

    host.className = 'flowact-png-export-host';
    host.style.position = 'fixed';
    host.style.left = '-100000px';
    host.style.top = '0';
    host.style.width = `${PNG_WIDTH}px`;
    host.style.height = `${PNG_HEIGHT}px`;
    host.style.overflow = 'hidden';
    host.style.pointerEvents = 'none';
    host.style.background = '#f8fafc';

    document.body.append(host);

    return host;
}

function prepareExportNodes(nodes: NotebookNode[]): NotebookNode[] {
    return nodes.map((node) => ({
        ...node,
        selected: false,
        draggable: false,
        selectable: false,
        data: {
            ...node.data,
            status: node.data.status ?? 'idle',
            canAutocomplete: false,
        },
    }));
}

function prepareExportEdges(edges: Edge[]): Edge[] {
    return edges.map((edge) => ({
        ...edge,
        selected: false,
        selectable: false,
        animated: false,
    }));
}

function renderHiddenReactFlow(payload: NotebookPayloadDto, host: HTMLElement): Root {
    const { nodes, edges } = fromNotebookPayload(payload);
    const exportNodes = prepareExportNodes(nodes);
    const exportEdges = prepareExportEdges(edges);
    const root = createRoot(host);

    root.render(
        createElement(
            ReactFlowProvider,
            null,
            createElement(
                'div',
                {
                    className: 'flowact-png-export-frame',
                    style: {
                        width: `${PNG_WIDTH}px`,
                        height: `${PNG_HEIGHT}px`,
                        background: '#f8fafc',
                    },
                },
                createElement(
                    ReactFlow,
                    {
                        nodes: exportNodes,
                        edges: exportEdges,
                        nodeTypes: exportNodeTypes,
                        fitView: true,
                        fitViewOptions: {
                            padding: 0.18,
                            minZoom: 0.12,
                            maxZoom: 1.25,
                        },
                        nodesDraggable: false,
                        nodesConnectable: false,
                        elementsSelectable: false,
                        panOnDrag: false,
                        zoomOnScroll: false,
                        zoomOnPinch: false,
                        zoomOnDoubleClick: false,
                        preventScrolling: false,
                        proOptions: {
                            hideAttribution: true,
                        },
                    },
                    createElement(Background, {
                        color: '#cbd5e1',
                        gap: GRID_GAP,
                        size: 1.4,
                    }),
                ),
            ),
        ),
    );

    return root;
}

function roundRect(
    context: CanvasRenderingContext2D,
    rect: CanvasRect,
    radius: number,
) {
    const normalizedRadius = Math.max(0, Math.min(radius, rect.width / 2, rect.height / 2));

    context.beginPath();
    context.moveTo(rect.x + normalizedRadius, rect.y);
    context.lineTo(rect.x + rect.width - normalizedRadius, rect.y);
    context.quadraticCurveTo(
        rect.x + rect.width,
        rect.y,
        rect.x + rect.width,
        rect.y + normalizedRadius,
    );
    context.lineTo(rect.x + rect.width, rect.y + rect.height - normalizedRadius);
    context.quadraticCurveTo(
        rect.x + rect.width,
        rect.y + rect.height,
        rect.x + rect.width - normalizedRadius,
        rect.y + rect.height,
    );
    context.lineTo(rect.x + normalizedRadius, rect.y + rect.height);
    context.quadraticCurveTo(
        rect.x,
        rect.y + rect.height,
        rect.x,
        rect.y + rect.height - normalizedRadius,
    );
    context.lineTo(rect.x, rect.y + normalizedRadius);
    context.quadraticCurveTo(rect.x, rect.y, rect.x + normalizedRadius, rect.y);
    context.closePath();
}

function getElementCanvasRect(element: HTMLElement, rootRect: DOMRect): CanvasRect {
    const rect = element.getBoundingClientRect();

    return {
        x: rect.left - rootRect.left,
        y: rect.top - rootRect.top,
        width: rect.width,
        height: rect.height,
    };
}

function drawGrid(context: CanvasRenderingContext2D) {
    context.save();
    context.fillStyle = '#f8fafc';
    context.fillRect(0, 0, PNG_WIDTH, PNG_HEIGHT);
    context.fillStyle = 'rgba(148, 163, 184, 0.38)';

    for (let x = 0; x <= PNG_WIDTH; x += GRID_GAP) {
        for (let y = 0; y <= PNG_HEIGHT; y += GRID_GAP) {
            context.beginPath();
            context.arc(x, y, 1.15, 0, Math.PI * 2);
            context.fill();
        }
    }

    context.restore();
}

function drawConnection(
    context: CanvasRenderingContext2D,
    sourceRect: CanvasRect,
    targetRect: CanvasRect,
    connection: NotebookConnectionDto,
) {
    const sourceYRatio = connection.sourceHandle === 'yes'
        ? 0.35
        : connection.sourceHandle === 'no'
            ? 0.68
            : 0.5;
    const start = {
        x: sourceRect.x + sourceRect.width,
        y: sourceRect.y + sourceRect.height * sourceYRatio,
    };
    const end = {
        x: targetRect.x,
        y: targetRect.y + targetRect.height / 2,
    };
    const controlOffset = Math.max(80, Math.abs(end.x - start.x) * 0.45);

    context.save();
    context.strokeStyle = '#94a3b8';
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.bezierCurveTo(
        start.x + controlOffset,
        start.y,
        end.x - controlOffset,
        end.y,
        end.x,
        end.y,
    );
    context.stroke();

    if (connection.label) {
        const labelX = (start.x + end.x) / 2;
        const labelY = (start.y + end.y) / 2;

        context.fillStyle = '#ffffff';
        roundRect(context, {
            x: labelX - 24,
            y: labelY - 15,
            width: 48,
            height: 28,
        }, 14);
        context.fill();
        context.fillStyle = '#111827';
        context.font = '700 16px Arial, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(connection.label, labelX, labelY);
    }

    context.restore();
}

function drawText(
    context: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
) {
    if (!text.trim()) {
        return;
    }

    context.fillText(text, x, y, maxWidth);
}

function drawNode(
    context: CanvasRenderingContext2D,
    nodeElement: HTMLElement,
    rootRect: DOMRect,
) {
    const blockElement = nodeElement.querySelector<HTMLElement>(
        '.custom-block-node, .ai-block-node',
    ) ?? nodeElement;
    const blockRect = getElementCanvasRect(blockElement, rootRect);
    const styles = window.getComputedStyle(blockElement);
    const titleElement = blockElement.querySelector<HTMLElement>(
        '.custom-block-node__title, .ai-block-node__title',
    );
    const subtitleElement = blockElement.querySelector<HTMLElement>(
        '.custom-block-node__subtitle, .ai-block-node__model, .custom-block-node__description, .ai-block-node__prompt',
    );
    const titleStyles = titleElement
        ? window.getComputedStyle(titleElement)
        : styles;
    const subtitleStyles = subtitleElement
        ? window.getComputedStyle(subtitleElement)
        : styles;
    const radius = Number.parseFloat(styles.borderRadius) || 14;

    context.save();
    context.shadowColor = 'rgba(15, 23, 42, 0.28)';
    context.shadowBlur = 18;
    context.shadowOffsetY = 8;
    context.fillStyle = styles.backgroundColor || '#111827';
    roundRect(context, blockRect, radius);
    context.fill();

    if (styles.borderWidth !== '0px') {
        context.shadowColor = 'transparent';
        context.strokeStyle = styles.borderColor || 'rgba(148, 163, 184, 0.24)';
        context.lineWidth = Math.max(1, Number.parseFloat(styles.borderWidth) || 1);
        context.stroke();
    }

    context.shadowColor = 'transparent';
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillStyle = titleStyles.color || '#ffffff';
    context.font = `700 ${Math.max(15, Number.parseFloat(titleStyles.fontSize) || 16)}px ${titleStyles.fontFamily || 'Arial, sans-serif'}`;
    drawText(
        context,
        titleElement?.textContent?.trim() || 'Блок',
        blockRect.x + 18,
        blockRect.y + blockRect.height / 2 - 8,
        blockRect.width - 36,
    );

    if (subtitleElement?.textContent?.trim()) {
        context.fillStyle = subtitleStyles.color || 'rgba(226, 232, 240, 0.78)';
        context.font = `500 ${Math.max(12, Number.parseFloat(subtitleStyles.fontSize) || 12)}px ${subtitleStyles.fontFamily || 'Arial, sans-serif'}`;
        drawText(
            context,
            subtitleElement.textContent.trim(),
            blockRect.x + 18,
            blockRect.y + blockRect.height / 2 + 15,
            blockRect.width - 36,
        );
    }

    context.restore();
}

function drawReactFlowToCanvas(
    payload: NotebookPayloadDto,
    exportElement: HTMLElement,
) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('Не удалось подготовить canvas для PNG-экспорта.');
    }

    canvas.width = PNG_WIDTH;
    canvas.height = PNG_HEIGHT;
    drawGrid(context);

    const rootRect = exportElement.getBoundingClientRect();
    const nodeElements = Array.from(
        exportElement.querySelectorAll<HTMLElement>('.react-flow__node[data-id]'),
    );
    const nodeRectsById = new Map<string, CanvasRect>();

    nodeElements.forEach((nodeElement) => {
        const nodeId = nodeElement.dataset.id;
        const blockElement = nodeElement.querySelector<HTMLElement>(
            '.custom-block-node, .ai-block-node',
        ) ?? nodeElement;

        if (nodeId) {
            nodeRectsById.set(nodeId, getElementCanvasRect(blockElement, rootRect));
        }
    });

    payload.connections.forEach((connection) => {
        const sourceRect = nodeRectsById.get(connection.sourceBlockId);
        const targetRect = nodeRectsById.get(connection.targetBlockId);

        if (sourceRect && targetRect) {
            drawConnection(context, sourceRect, targetRect, connection);
        }
    });

    nodeElements.forEach((nodeElement) => {
        drawNode(context, nodeElement, rootRect);
    });

    return canvas;
}

function downloadCanvasAsPng(canvas: HTMLCanvasElement, fileName: string) {
    return new Promise<void>((resolve, reject) => {
        try {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Не удалось сформировать PNG-файл.'));
                    return;
                }

                downloadBlob(blob, fileName);
                resolve();
            }, 'image/png');
        } catch (error) {
            reject(error instanceof Error
                ? error
                : new Error('Не удалось сформировать PNG-файл.'));
        }
    });
}

export function exportNotebookAsJson(payload: NotebookPayloadDto) {
    const exportPayload: NotebookExportPayload = {
        schema: EXPORT_SCHEMA,
        exportVersion: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        notebook: clonePayloadForExport(payload),
    };

    downloadBlob(
        new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' }),
        `${sanitizeFileName(payload.title)}.flowact.json`,
    );
}

export async function exportNotebookAsPng(payload: NotebookPayloadDto) {
    const host = createOffscreenContainer();
    const root = renderHiddenReactFlow(payload, host);

    try {
        await waitForReactFlowRender();

        const exportElement = host.querySelector<HTMLElement>('.flowact-png-export-frame');

        if (!exportElement) {
            throw new Error('Не удалось найти отрисованный ReactFlow canvas для PNG-экспорта.');
        }

        const canvas = drawReactFlowToCanvas(payload, exportElement);

        await downloadCanvasAsPng(canvas, `${sanitizeFileName(payload.title)}.png`);
    } finally {
        root.unmount();
        host.remove();
    }
}

export async function importNotebookFromJsonFile(file: File): Promise<NotebookPayloadDto> {
    const rawContent = await file.text();
    const parsedContent = JSON.parse(rawContent) as unknown;
    const notebookPayload = readNotebookFromUnknown(parsedContent);

    return saveNotebookLocally(notebookPayload, {
        enqueueSync: true,
        syncReason: 'import-json-notebook',
    });
}

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
import type { NotebookBlockType, NotebookNode } from '../components/notebook/notebookTypes';
import { saveNotebookLocally } from './notebookStorage';

import '@xyflow/react/dist/style.css';

const EXPORT_SCHEMA = 'flowact.notebook.export';
const EXPORT_VERSION = 1;
const PNG_WIDTH = 1600;
const PNG_HEIGHT = 900;
const RENDER_WAIT_MS = 260;
const GRID_GAP = 22;

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

type BlockPalette = {
    accent: string;
    accentSoft: string;
    cardStart: string;
    cardEnd: string;
    label: string;
    icon: string;
};

const exportNodeTypes: NodeTypes = {
    customBlock: CustomBlockNode,
    aiBlock: AiBlockNode,
};

const defaultPalette: BlockPalette = {
    accent: '#38bdf8',
    accentSoft: 'rgba(56, 189, 248, 0.18)',
    cardStart: '#111827',
    cardEnd: '#0f172a',
    label: 'BLOCK',
    icon: '•',
};

const blockPalettes: Record<NotebookBlockType, BlockPalette> = {
    start: {
        accent: '#22c55e',
        accentSoft: 'rgba(34, 197, 94, 0.18)',
        cardStart: '#11251a',
        cardEnd: '#0f172a',
        label: 'START',
        icon: '▶',
    },
    end: {
        accent: '#ef4444',
        accentSoft: 'rgba(239, 68, 68, 0.18)',
        cardStart: '#2a1217',
        cardEnd: '#0f172a',
        label: 'END',
        icon: '■',
    },
    ai: {
        accent: '#22d3ee',
        accentSoft: 'rgba(34, 211, 238, 0.2)',
        cardStart: '#102436',
        cardEnd: '#0f172a',
        label: 'AI',
        icon: 'AI',
    },
    condition: {
        accent: '#facc15',
        accentSoft: 'rgba(250, 204, 21, 0.2)',
        cardStart: '#2b2410',
        cardEnd: '#111827',
        label: 'IF',
        icon: '?',
    },
    action: {
        accent: '#fb7185',
        accentSoft: 'rgba(251, 113, 133, 0.18)',
        cardStart: '#2a1621',
        cardEnd: '#111827',
        label: 'ACTION',
        icon: '⚙',
    },
    database: {
        accent: '#60a5fa',
        accentSoft: 'rgba(96, 165, 250, 0.18)',
        cardStart: '#132138',
        cardEnd: '#0f172a',
        label: 'DB',
        icon: 'DB',
    },
    email: {
        accent: '#a78bfa',
        accentSoft: 'rgba(167, 139, 250, 0.18)',
        cardStart: '#211a38',
        cardEnd: '#0f172a',
        label: 'EMAIL',
        icon: '@',
    },
    log: {
        accent: '#94a3b8',
        accentSoft: 'rgba(148, 163, 184, 0.18)',
        cardStart: '#1e293b',
        cardEnd: '#0f172a',
        label: 'LOG',
        icon: 'log',
    },
    http: {
        accent: '#38bdf8',
        accentSoft: 'rgba(56, 189, 248, 0.18)',
        cardStart: '#11273a',
        cardEnd: '#0f172a',
        label: 'HTTP',
        icon: '↗',
    },
    loop: {
        accent: '#f97316',
        accentSoft: 'rgba(249, 115, 22, 0.18)',
        cardStart: '#2b1a10',
        cardEnd: '#111827',
        label: 'LOOP',
        icon: '↻',
    },
    merge: {
        accent: '#14b8a6',
        accentSoft: 'rgba(20, 184, 166, 0.18)',
        cardStart: '#102724',
        cardEnd: '#0f172a',
        label: 'MERGE',
        icon: '⇄',
    },
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
                            padding: 0.1,
                            minZoom: 0.12,
                            maxZoom: 1.45,
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

function getPalette(blockType?: NotebookBlockType): BlockPalette {
    if (!blockType) {
        return defaultPalette;
    }

    return blockPalettes[blockType] ?? defaultPalette;
}

function normalizeText(value: string | undefined, maxLength = 96) {
    const normalized = (value ?? '').replace(/\s+/g, ' ').trim();

    if (normalized.length <= maxLength) {
        return normalized;
    }

    return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function getBlockDetails(block?: NotebookBlockDto) {
    if (!block) {
        return '';
    }

    if (block.subtitle) {
        return block.subtitle;
    }

    if (block.type === 'ai') {
        return block.config?.ai?.prompt || block.description || 'AI-обработка данных';
    }

    if (block.type === 'http') {
        const method = block.config?.http?.method ?? 'HTTP';
        const url = block.config?.http?.url ?? block.description;

        return normalizeText(`${method} ${url ?? ''}`, 120);
    }

    if (block.type === 'condition' && block.config?.condition) {
        const condition = block.config.condition;

        return `${condition.leftValue} ${condition.operator} ${condition.rightValue}`;
    }

    if (block.type === 'log') {
        return block.config?.log?.messageTemplate || block.description || 'Логирование результата';
    }

    return block.description || '';
}

function wrapText(
    context: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxLines: number,
) {
    const words = normalizeText(text, 140).split(' ').filter(Boolean);
    const lines: string[] = [];
    let currentLine = '';

    words.forEach((word) => {
        const nextLine = currentLine ? `${currentLine} ${word}` : word;

        if (context.measureText(nextLine).width <= maxWidth || !currentLine) {
            currentLine = nextLine;
            return;
        }

        lines.push(currentLine);
        currentLine = word;
    });

    if (currentLine) {
        lines.push(currentLine);
    }

    const visibleLines = lines.slice(0, maxLines);

    if (lines.length > maxLines && visibleLines.length > 0) {
        visibleLines[visibleLines.length - 1] = `${visibleLines[visibleLines.length - 1].replace(/…?$/, '')}…`;
    }

    return visibleLines;
}

function drawWrappedText(params: {
    context: CanvasRenderingContext2D;
    text: string;
    x: number;
    y: number;
    lineHeight: number;
    maxWidth: number;
    maxLines: number;
}) {
    const lines = wrapText(
        params.context,
        params.text,
        params.maxWidth,
        params.maxLines,
    );

    lines.forEach((line, index) => {
        params.context.fillText(
            line,
            params.x,
            params.y + index * params.lineHeight,
            params.maxWidth,
        );
    });
}

function drawExportBackground(context: CanvasRenderingContext2D, payload: NotebookPayloadDto) {
    const background = context.createLinearGradient(0, 0, PNG_WIDTH, PNG_HEIGHT);

    background.addColorStop(0, '#f8fbff');
    background.addColorStop(0.48, '#edf7ff');
    background.addColorStop(1, '#eef2ff');

    context.fillStyle = background;
    context.fillRect(0, 0, PNG_WIDTH, PNG_HEIGHT);

    const glow = context.createRadialGradient(240, 80, 40, 240, 80, 520);

    glow.addColorStop(0, 'rgba(34, 211, 238, 0.2)');
    glow.addColorStop(1, 'rgba(34, 211, 238, 0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, PNG_WIDTH, PNG_HEIGHT);

    context.fillStyle = 'rgba(148, 163, 184, 0.36)';

    for (let x = 0; x <= PNG_WIDTH; x += GRID_GAP) {
        for (let y = 0; y <= PNG_HEIGHT; y += GRID_GAP) {
            context.beginPath();
            context.arc(x, y, 1.05, 0, Math.PI * 2);
            context.fill();
        }
    }

    context.save();
    context.fillStyle = 'rgba(15, 23, 42, 0.92)';
    roundRect(context, {
        x: 42,
        y: 32,
        width: 430,
        height: 88,
    }, 24);
    context.fill();
    context.fillStyle = '#22d3ee';
    context.font = '800 30px Arial, sans-serif';
    context.textBaseline = 'middle';
    context.fillText('FlowAct', 70, 64);
    context.fillStyle = '#e2e8f0';
    context.font = '700 20px Arial, sans-serif';
    context.fillText(normalizeText(payload.title || 'Notebook', 34), 70, 94, 360);

    context.fillStyle = 'rgba(15, 23, 42, 0.76)';
    roundRect(context, {
        x: PNG_WIDTH - 408,
        y: 36,
        width: 360,
        height: 58,
    }, 20);
    context.fill();
    context.fillStyle = '#cbd5e1';
    context.font = '600 18px Arial, sans-serif';
    context.textAlign = 'center';
    context.fillText(
        `${payload.blocks.length} блоков · ${payload.connections.length} связей`,
        PNG_WIDTH - 228,
        66,
    );
    context.restore();
}

function drawArrowHead(
    context: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
    color: string,
) {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const size = 12;

    context.save();
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(to.x, to.y);
    context.lineTo(
        to.x - size * Math.cos(angle - Math.PI / 6),
        to.y - size * Math.sin(angle - Math.PI / 6),
    );
    context.lineTo(
        to.x - size * Math.cos(angle + Math.PI / 6),
        to.y - size * Math.sin(angle + Math.PI / 6),
    );
    context.closePath();
    context.fill();
    context.restore();
}

function drawConnection(
    context: CanvasRenderingContext2D,
    sourceRect: CanvasRect,
    targetRect: CanvasRect,
    connection: NotebookConnectionDto,
    sourceBlock?: NotebookBlockDto,
    targetBlock?: NotebookBlockDto,
) {
    const sourcePalette = getPalette(sourceBlock?.type);
    const targetPalette = getPalette(targetBlock?.type);
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
    const gradient = context.createLinearGradient(start.x, start.y, end.x, end.y);

    gradient.addColorStop(0, sourcePalette.accent);
    gradient.addColorStop(1, targetPalette.accent);

    context.save();
    context.strokeStyle = gradient;
    context.lineWidth = 4;
    context.lineCap = 'round';
    context.shadowColor = 'rgba(15, 23, 42, 0.14)';
    context.shadowBlur = 6;
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
    context.shadowColor = 'transparent';
    drawArrowHead(context, {
        x: end.x - 26,
        y: end.y,
    }, end, targetPalette.accent);

    if (connection.label) {
        const labelX = (start.x + end.x) / 2;
        const labelY = (start.y + end.y) / 2;

        context.fillStyle = '#ffffff';
        roundRect(context, {
            x: labelX - 28,
            y: labelY - 16,
            width: 56,
            height: 30,
        }, 15);
        context.fill();
        context.strokeStyle = 'rgba(148, 163, 184, 0.28)';
        context.lineWidth = 1;
        context.stroke();
        context.fillStyle = '#111827';
        context.font = '700 16px Arial, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(connection.label, labelX, labelY);
    }

    context.restore();
}

function drawNode(
    context: CanvasRenderingContext2D,
    nodeElement: HTMLElement,
    rootRect: DOMRect,
    block?: NotebookBlockDto,
) {
    const blockElement = nodeElement.querySelector<HTMLElement>(
        '.custom-block-node, .ai-block-node',
    ) ?? nodeElement;
    const blockRect = getElementCanvasRect(blockElement, rootRect);
    const palette = getPalette(block?.type);
    const title = normalizeText(block?.title || 'Блок', 48);
    const details = normalizeText(getBlockDetails(block), 120);
    const cardGradient = context.createLinearGradient(
        blockRect.x,
        blockRect.y,
        blockRect.x + blockRect.width,
        blockRect.y + blockRect.height,
    );

    cardGradient.addColorStop(0, palette.cardStart);
    cardGradient.addColorStop(1, palette.cardEnd);

    context.save();
    context.shadowColor = 'rgba(15, 23, 42, 0.28)';
    context.shadowBlur = 24;
    context.shadowOffsetY = 10;
    context.fillStyle = cardGradient;
    roundRect(context, blockRect, 16);
    context.fill();

    context.shadowColor = 'transparent';
    context.strokeStyle = palette.accent;
    context.globalAlpha = 0.75;
    context.lineWidth = 2;
    context.stroke();
    context.globalAlpha = 1;

    context.fillStyle = palette.accent;
    roundRect(context, {
        x: blockRect.x,
        y: blockRect.y,
        width: 7,
        height: blockRect.height,
    }, 16);
    context.fill();

    context.fillStyle = palette.accentSoft;
    context.beginPath();
    context.arc(blockRect.x + 30, blockRect.y + 30, 17, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = palette.accent;
    context.font = palette.icon.length > 2
        ? '700 10px Arial, sans-serif'
        : '800 13px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(palette.icon, blockRect.x + 30, blockRect.y + 30);

    context.fillStyle = palette.accentSoft;
    roundRect(context, {
        x: blockRect.x + blockRect.width - 78,
        y: blockRect.y + 14,
        width: 58,
        height: 24,
    }, 12);
    context.fill();
    context.fillStyle = palette.accent;
    context.font = '800 11px Arial, sans-serif';
    context.textAlign = 'center';
    context.fillText(palette.label, blockRect.x + blockRect.width - 49, blockRect.y + 26);

    context.textAlign = 'left';
    context.fillStyle = '#ffffff';
    context.font = '800 17px Arial, sans-serif';
    drawWrappedText({
        context,
        text: title,
        x: blockRect.x + 56,
        y: blockRect.y + 31,
        lineHeight: 19,
        maxWidth: Math.max(80, blockRect.width - 148),
        maxLines: 1,
    });

    if (details) {
        context.fillStyle = '#cbd5e1';
        context.font = '600 12px Arial, sans-serif';
        drawWrappedText({
            context,
            text: details,
            x: blockRect.x + 18,
            y: blockRect.y + Math.max(60, blockRect.height / 2 + 4),
            lineHeight: 16,
            maxWidth: Math.max(100, blockRect.width - 36),
            maxLines: blockRect.height > 104 ? 2 : 1,
        });
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
    drawExportBackground(context, payload);

    const rootRect = exportElement.getBoundingClientRect();
    const blocksById = new Map(payload.blocks.map((block) => [block.id, block]));
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
            drawConnection(
                context,
                sourceRect,
                targetRect,
                connection,
                blocksById.get(connection.sourceBlockId),
                blocksById.get(connection.targetBlockId),
            );
        }
    });

    nodeElements.forEach((nodeElement) => {
        const nodeId = nodeElement.dataset.id;

        drawNode(context, nodeElement, rootRect, nodeId ? blocksById.get(nodeId) : undefined);
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

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

type NotebookExportPayload = {
    schema: typeof EXPORT_SCHEMA;
    exportVersion: typeof EXPORT_VERSION;
    exportedAt: string;
    notebook: NotebookPayloadDto;
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
                        gap: 18,
                        size: 1.4,
                    }),
                ),
            ),
        ),
    );

    return root;
}

function inlineComputedStyles(source: Element, target: Element) {
    const computedStyle = window.getComputedStyle(source);
    let cssText = '';

    for (let index = 0; index < computedStyle.length; index += 1) {
        const propertyName = computedStyle.item(index);

        cssText += `${propertyName}:${computedStyle.getPropertyValue(propertyName)};`;
    }

    target.setAttribute('style', cssText);

    Array.from(source.children).forEach((child, index) => {
        const targetChild = target.children.item(index);

        if (targetChild) {
            inlineComputedStyles(child, targetChild);
        }
    });
}

function createCanvasFromForeignObject(element: HTMLElement) {
    const clonedElement = element.cloneNode(true) as HTMLElement;

    inlineComputedStyles(element, clonedElement);
    clonedElement.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

    const serializedElement = new XMLSerializer().serializeToString(clonedElement);
    const svgContent = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${PNG_WIDTH}" height="${PNG_HEIGHT}">`,
        `<foreignObject width="100%" height="100%">${serializedElement}</foreignObject>`,
        '</svg>',
    ].join('');

    const svgBlob = new Blob([svgContent], {
        type: 'image/svg+xml;charset=utf-8',
    });
    const svgUrl = URL.createObjectURL(svgBlob);

    return new Promise<HTMLCanvasElement>((resolve, reject) => {
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(svgUrl);

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            if (!context) {
                reject(new Error('Не удалось подготовить canvas для PNG-экспорта.'));
                return;
            }

            canvas.width = PNG_WIDTH;
            canvas.height = PNG_HEIGHT;
            context.fillStyle = '#f8fafc';
            context.fillRect(0, 0, PNG_WIDTH, PNG_HEIGHT);
            context.drawImage(image, 0, 0, PNG_WIDTH, PNG_HEIGHT);
            resolve(canvas);
        };

        image.onerror = () => {
            URL.revokeObjectURL(svgUrl);
            reject(new Error('Не удалось отрисовать notebook canvas в PNG.'));
        };

        image.src = svgUrl;
    });
}

function downloadCanvasAsPng(canvas: HTMLCanvasElement, fileName: string) {
    return new Promise<void>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Не удалось сформировать PNG-файл.'));
                return;
            }

            downloadBlob(blob, fileName);
            resolve();
        }, 'image/png');
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

        const canvas = await createCanvasFromForeignObject(exportElement);

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

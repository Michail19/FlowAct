import type {
    NotebookBlockDto,
    NotebookConnectionDto,
    NotebookPayloadDto,
} from '../components/notebook/notebookBackendTypes';
import { saveNotebookLocally } from './notebookStorage';

const EXPORT_SCHEMA = 'flowact.notebook.export';
const EXPORT_VERSION = 1;
const PNG_WIDTH = 1600;
const PNG_HEIGHT = 1000;
const PNG_PADDING = 96;

type NotebookExportPayload = {
    schema: typeof EXPORT_SCHEMA;
    exportVersion: typeof EXPORT_VERSION;
    exportedAt: string;
    notebook: NotebookPayloadDto;
};

type NormalizedBounds = {
    minX: number;
    minY: number;
    scale: number;
    offsetX: number;
    offsetY: number;
};

const blockColors: Record<string, string> = {
    start: '#22c55e',
    end: '#ef4444',
    ai: '#22d3ee',
    condition: '#facc15',
    action: '#fb7185',
    database: '#60a5fa',
    email: '#a78bfa',
    log: '#94a3b8',
    http: '#38bdf8',
    loop: '#f97316',
    merge: '#14b8a6',
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

function getBlockSize(block: NotebookBlockDto) {
    return {
        width: block.type === 'ai' ? 230 : 180,
        height: block.type === 'condition' ? 82 : 72,
    };
}

function getBlockCenter(block: NotebookBlockDto, bounds: NormalizedBounds) {
    const size = getBlockSize(block);

    return {
        x: bounds.offsetX + (block.position.x - bounds.minX) * bounds.scale + size.width * bounds.scale / 2,
        y: bounds.offsetY + (block.position.y - bounds.minY) * bounds.scale + size.height * bounds.scale / 2,
    };
}

function calculateBounds(blocks: NotebookBlockDto[]): NormalizedBounds {
    if (blocks.length === 0) {
        return {
            minX: 0,
            minY: 0,
            scale: 1,
            offsetX: PNG_PADDING,
            offsetY: PNG_PADDING,
        };
    }

    const minX = Math.min(...blocks.map((block) => block.position.x));
    const minY = Math.min(...blocks.map((block) => block.position.y));
    const maxX = Math.max(...blocks.map((block) => block.position.x + getBlockSize(block).width));
    const maxY = Math.max(...blocks.map((block) => block.position.y + getBlockSize(block).height));
    const width = Math.max(maxX - minX, 1);
    const height = Math.max(maxY - minY, 1);
    const availableWidth = PNG_WIDTH - PNG_PADDING * 2;
    const availableHeight = PNG_HEIGHT - PNG_PADDING * 2;
    const scale = Math.min(1.35, availableWidth / width, availableHeight / height);

    return {
        minX,
        minY,
        scale,
        offsetX: (PNG_WIDTH - width * scale) / 2,
        offsetY: (PNG_HEIGHT - height * scale) / 2 + 20,
    };
}

function roundRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
}

function drawConnections(
    context: CanvasRenderingContext2D,
    payload: NotebookPayloadDto,
    bounds: NormalizedBounds,
) {
    const blocksById = new Map(payload.blocks.map((block) => [block.id, block]));

    context.save();
    context.strokeStyle = '#64748b';
    context.lineWidth = 4;
    context.lineCap = 'round';

    payload.connections.forEach((connection) => {
        const source = blocksById.get(connection.sourceBlockId);
        const target = blocksById.get(connection.targetBlockId);

        if (!source || !target) {
            return;
        }

        const sourceSize = getBlockSize(source);
        const targetSize = getBlockSize(target);
        const start = {
            x: bounds.offsetX + (source.position.x - bounds.minX + sourceSize.width) * bounds.scale,
            y: bounds.offsetY + (source.position.y - bounds.minY + sourceSize.height / 2) * bounds.scale,
        };
        const end = {
            x: bounds.offsetX + (target.position.x - bounds.minX) * bounds.scale,
            y: bounds.offsetY + (target.position.y - bounds.minY + targetSize.height / 2) * bounds.scale,
        };
        const controlOffset = Math.max(80, Math.abs(end.x - start.x) * 0.45);

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
            const labelY = (start.y + end.y) / 2 - 10;

            context.fillStyle = '#f8fafc';
            roundRect(context, labelX - 24, labelY - 15, 48, 28, 14);
            context.fill();
            context.fillStyle = '#0f172a';
            context.font = '700 18px Arial, sans-serif';
            context.textAlign = 'center';
            context.fillText(connection.label, labelX, labelY + 6);
        }
    });

    context.restore();
}

function drawBlocks(
    context: CanvasRenderingContext2D,
    payload: NotebookPayloadDto,
    bounds: NormalizedBounds,
) {
    payload.blocks.forEach((block) => {
        const size = getBlockSize(block);
        const x = bounds.offsetX + (block.position.x - bounds.minX) * bounds.scale;
        const y = bounds.offsetY + (block.position.y - bounds.minY) * bounds.scale;
        const width = size.width * bounds.scale;
        const height = size.height * bounds.scale;
        const color = blockColors[block.type] ?? '#334155';

        context.save();
        context.shadowColor = 'rgba(15, 23, 42, 0.22)';
        context.shadowBlur = 20;
        context.shadowOffsetY = 8;
        context.fillStyle = color;
        roundRect(context, x, y, width, height, Math.min(24, height / 2));
        context.fill();
        context.shadowColor = 'transparent';

        context.fillStyle = block.type === 'condition' ? '#111827' : '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = `${Math.max(18, 22 * bounds.scale)}px Arial, sans-serif`;
        context.fillText(block.title || block.type, x + width / 2, y + height / 2 - 6);

        if (block.subtitle) {
            context.globalAlpha = 0.82;
            context.font = `${Math.max(12, 13 * bounds.scale)}px Arial, sans-serif`;
            context.fillText(block.subtitle, x + width / 2, y + height / 2 + 18);
        }

        context.restore();
    });
}

function drawEmptyState(context: CanvasRenderingContext2D) {
    context.fillStyle = '#64748b';
    context.font = '600 36px Arial, sans-serif';
    context.textAlign = 'center';
    context.fillText('Notebook пока пуст', PNG_WIDTH / 2, PNG_HEIGHT / 2);
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
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('Не удалось подготовить canvas для экспорта PNG.');
    }

    canvas.width = PNG_WIDTH;
    canvas.height = PNG_HEIGHT;

    context.fillStyle = '#f8fafc';
    context.fillRect(0, 0, PNG_WIDTH, PNG_HEIGHT);
    context.fillStyle = '#0f172a';
    context.font = '800 44px Arial, sans-serif';
    context.fillText(payload.title || 'FlowAct notebook', PNG_PADDING, 70);
    context.fillStyle = '#64748b';
    context.font = '20px Arial, sans-serif';
    context.fillText(`Экспортировано ${new Date().toLocaleString('ru-RU')}`, PNG_PADDING, 104);

    const bounds = calculateBounds(payload.blocks);

    if (payload.blocks.length === 0) {
        drawEmptyState(context);
    } else {
        drawConnections(context, payload, bounds);
        drawBlocks(context, payload, bounds);
    }

    await new Promise<void>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Не удалось сформировать PNG-файл.'));
                return;
            }

            downloadBlob(blob, `${sanitizeFileName(payload.title)}.png`);
            resolve();
        }, 'image/png');
    });
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

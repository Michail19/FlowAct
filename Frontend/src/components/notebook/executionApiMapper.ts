import type {
    NotebookExecutionLog,
    WorkflowExecutionResult,
    WorkflowExecutionStatus,
} from './executionTypes';
import {
    mapApiExecutionStatus,
} from './executionTypes';
import type {
    ExecutionLogResponse,
    ExecutionResponse,
} from '../../services/workflowApiTypes';

function getLogLevelByApiStatus(
    status: ExecutionLogResponse['status'],
): NotebookExecutionLog['level'] {
    switch (status) {
        case 'SUCCESS':
            return 'success';

        case 'FAILED':
            return 'error';

        case 'SKIPPED':
        case 'WAITING':
            return 'warning';

        case 'PENDING':
        case 'RUNNING':
        default:
            return 'info';
    }
}

function mapApiLogStatusToWorkflowStatus(
    status: ExecutionLogResponse['status'],
): WorkflowExecutionStatus {
    switch (status) {
        case 'PENDING':
            return 'pending';

        case 'RUNNING':
            return 'running';

        case 'SUCCESS':
            return 'success';

        case 'FAILED':
            return 'error';

        case 'WAITING':
            return 'waiting';

        case 'SKIPPED':
            return 'running';
    }
}

export function toNotebookExecutionLog(
    log: ExecutionLogResponse,
): NotebookExecutionLog {
    return {
        id: log.id,
        level: getLogLevelByApiStatus(log.status),
        status: mapApiLogStatusToWorkflowStatus(log.status),
        blockId: log.blockId,
        message:
            log.error ??
            (log.output ? JSON.stringify(log.output) : `Статус блока: ${log.status}`),
        createdAt: log.createdAt,
    };
}

export function toWorkflowExecutionResult(
    execution: ExecutionResponse,
): WorkflowExecutionResult | null {
    const status = mapApiExecutionStatus(execution.status);

    if (status !== 'success' && status !== 'error' && status !== 'cancelled') {
        return null;
    }

    const startedAt = execution.startedAt ?? execution.createdAt;
    const finishedAt = execution.finishedAt ?? execution.updatedAt;

    return {
        id: execution.id,
        status: status === 'success' ? 'success' : status === 'cancelled' ? 'cancelled' : 'error',
        startedAt,
        finishedAt,
        durationMs:
            new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
        totalBlocks: 0,
        completedBlocks: 0,
        failedBlocks: status === 'error' ? 1 : 0,
        warningsCount: 0,
        errorsCount: status === 'error' ? 1 : 0,
        summary:
            status === 'success'
                ? 'Рабочий процесс успешно завершён'
                : status === 'cancelled'
                    ? 'Рабочий процесс отменён'
                    : 'Рабочий процесс завершился с ошибкой',
        output:
            execution.errorMessage ??
            extractReadableExecutionOutput(execution.outputData),
    };
}

function tryParseJson(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function getNestedValue(source: unknown, path: string[]): unknown {
    let currentValue = source;

    for (const key of path) {
        if (Array.isArray(currentValue)) {
            const index = Number(key);

            if (Number.isNaN(index) || index < 0 || index >= currentValue.length) {
                return undefined;
            }

            currentValue = currentValue[index];
            continue;
        }

        if (
            !currentValue ||
            typeof currentValue !== 'object' ||
            !(key in currentValue)
        ) {
            return undefined;
        }

        currentValue = (currentValue as Record<string, unknown>)[key];
    }

    return currentValue;
}

function extractReadableExecutionOutput(outputData: unknown): string {
    const normalizedOutput =
        typeof outputData === 'string' ? tryParseJson(outputData) : outputData;

    const preferredPaths = [
        ['value', 'text'],
        ['text'],
        ['value', 'body', 'choices', '0', 'message', 'content'],
        ['body', 'choices', '0', 'message', 'content'],
        ['value', 'body', 'extract'],
        ['body', 'extract'],
    ];

    for (const path of preferredPaths) {
        const value = getNestedValue(normalizedOutput, path);

        if (typeof value === 'string' && value.trim()) {
            return value;
        }
    }

    if (normalizedOutput && typeof normalizedOutput === 'object') {
        return JSON.stringify(normalizedOutput, null, 2);
    }

    return String(normalizedOutput ?? 'Backend не вернул outputData.');
}

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
            return 'skipped';
    }
}

function getShortLogMessage(
    log: ExecutionLogResponse,
    readableOutput?: string,
): string {
    if (!readableOutput) {
        return `Статус блока: ${log.status}`;
    }

    if (readableOutput.length <= 180) {
        return readableOutput;
    }

    return `${readableOutput.slice(0, 180).trim()}...`;
}

function getLogInputData(log: ExecutionLogResponse): unknown {
    return log.input ?? log.inputData ?? null;
}

function getLogOutputData(log: ExecutionLogResponse): unknown {
    return log.output ?? log.outputData ?? null;
}

function getLogErrorMessage(log: ExecutionLogResponse): string | null {
    return log.error ?? log.errorMessage ?? null;
}

function getLogDisplayMessage(
    log: ExecutionLogResponse,
    readableOutput?: string,
): string {
    if (typeof log.message === 'string' && log.message.trim()) {
        return log.message;
    }

    return getLogErrorMessage(log) ?? getShortLogMessage(log, readableOutput);
}

export function toNotebookExecutionLog(
    log: ExecutionLogResponse,
): NotebookExecutionLog {
    const logInput = getLogInputData(log);
    const logOutput = getLogOutputData(log);
    const logError = getLogErrorMessage(log);

    const readableInput = logInput
        ? extractReadableExecutionOutput(logInput)
        : null;

    const readableOutput = logOutput
        ? extractReadableExecutionOutput(logOutput)
        : null;

    return {
        id: log.id,
        level: getLogLevelByApiStatus(log.status),
        status: mapApiLogStatusToWorkflowStatus(log.status),
        blockId: log.blockId,
        message: getLogDisplayMessage(log, readableOutput?.output),
        input: readableInput?.output,
        rawInput: readableInput?.rawOutput,
        output: readableOutput?.output,
        rawOutput: readableOutput?.rawOutput,
        outputFormat: readableOutput?.outputFormat,
        error: logError,
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

    const readableOutput = execution.errorMessage
        ? {
            output: execution.errorMessage,
            outputFormat: 'text' as const,
            rawOutput: stringifyRawOutput(execution.outputData),
        }
        : extractReadableExecutionOutput(execution.outputData);

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
        output: readableOutput.output,
        outputFormat: readableOutput.outputFormat,
        rawOutput: readableOutput.rawOutput,
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

export function extractReadableExecutionOutput(
    outputData: unknown,
): ReadableExecutionOutput {
    const normalizedOutput =
        typeof outputData === 'string' ? tryParseJson(outputData) : outputData;

    const rawOutput = stringifyRawOutput(normalizedOutput);

    const preferredPaths = [
        ['value', 'text'],
        ['text'],
        ['value', 'body', 'choices', '0', 'message', 'content'],
        ['body', 'choices', '0', 'message', 'content'],
        ['value', 'body', 'extract'],
        ['body', 'extract'],
        ['value', 'body', 'title'],
        ['body', 'title'],
    ];

    for (const path of preferredPaths) {
        const value = getNestedValue(normalizedOutput, path);

        if (typeof value === 'string' && value.trim()) {
            return {
                output: value,
                outputFormat: 'text',
                rawOutput,
            };
        }
    }

    return {
        output: rawOutput,
        outputFormat: 'json',
        rawOutput,
    };
}

type ReadableExecutionOutput = {
    output: string;
    outputFormat: 'text' | 'json';
    rawOutput: string;
};

function stringifyRawOutput(value: unknown): string {
    if (value === undefined || value === null) {
        return 'Backend не вернул outputData.';
    }

    if (typeof value === 'string') {
        const parsedValue = tryParseJson(value);

        if (typeof parsedValue === 'string') {
            return value;
        }

        return JSON.stringify(parsedValue, null, 2);
    }

    return JSON.stringify(value, null, 2);
}

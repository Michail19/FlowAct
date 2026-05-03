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
            (execution.outputData
                ? JSON.stringify(execution.outputData)
                : 'Backend не вернул outputData.'),
    };
}

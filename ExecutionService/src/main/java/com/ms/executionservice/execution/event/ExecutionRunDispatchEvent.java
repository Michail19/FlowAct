package com.ms.executionservice.execution.event;

import java.util.UUID;

public record ExecutionRunDispatchEvent(
        UUID executionId,
        UUID workflowId,
        UUID notebookId,
        UUID startedByUserId
) {
}

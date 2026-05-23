package com.ms.executionservice.execution.event;

import java.util.UUID;

public record ExecutionCancelDispatchEvent(
        UUID executionId,
        UUID workflowId,
        UUID notebookId
) {
}

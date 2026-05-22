package com.ms.executionservice.execution.event;

import java.util.UUID;

public record ExecutionResumeDispatchEvent(
        UUID executionId,
        UUID workflowId,
        UUID notebookId,
        Object resumePayload
) {
}

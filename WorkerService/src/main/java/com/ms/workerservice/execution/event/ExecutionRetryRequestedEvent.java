package com.ms.workerservice.execution.event;

import lombok.Builder;

import java.time.OffsetDateTime;
import java.util.UUID;

@Builder
public record ExecutionRetryRequestedEvent(
        UUID eventId,
        String eventType,
        UUID sourceExecutionId,
        UUID executionId,
        UUID workflowId,
        UUID notebookId,
        UUID startedByUserId,
        String triggerType,
        OffsetDateTime createdAt
) {
}

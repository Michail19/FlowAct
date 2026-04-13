package com.ms.executionservice.execution.event;

import lombok.Builder;

import java.time.OffsetDateTime;
import java.util.UUID;

@Builder
public record ExecutionRunRequestedEvent(
        UUID eventId,
        String eventType,
        UUID executionId,
        UUID workflowId,
        UUID notebookId,
        UUID startedByUserId,
        String triggerType,
        OffsetDateTime createdAt
) {
}

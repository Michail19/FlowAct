package com.ms.executionservice.execution.dto.event;

import lombok.Builder;

import java.time.OffsetDateTime;
import java.util.UUID;

@Builder
public record ExecutionCancelRequestedEvent(
        UUID eventId,
        String eventType,
        UUID executionId,
        UUID workflowId,
        UUID notebookId,
        OffsetDateTime createdAt
) {
}

package com.ms.workerservice.execution.event;

import lombok.Builder;

import java.time.OffsetDateTime;
import java.util.UUID;

@Builder
public record ExecutionResumeRequestedEvent(
        UUID eventId,
        String eventType,
        UUID executionId,
        UUID workflowId,
        UUID notebookId,
        Object resumePayload,
        OffsetDateTime createdAt
) {
}

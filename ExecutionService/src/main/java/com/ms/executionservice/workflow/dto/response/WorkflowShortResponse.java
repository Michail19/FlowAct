package com.ms.executionservice.workflow.dto.response;

import com.ms.executionservice.workflow.enumtype.WorkflowStatus;
import lombok.Builder;

import java.time.OffsetDateTime;
import java.util.UUID;

@Builder
public record WorkflowShortResponse(
        UUID id,
        UUID notebookId,
        String name,
        String description,
        WorkflowStatus status,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}

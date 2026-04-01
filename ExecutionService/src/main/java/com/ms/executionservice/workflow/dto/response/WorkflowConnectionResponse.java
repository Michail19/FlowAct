package com.ms.executionservice.workflow.dto.response;

import lombok.Builder;

import java.time.OffsetDateTime;
import java.util.UUID;

@Builder
public record WorkflowConnectionResponse(
        UUID id,
        UUID workflowId,
        UUID fromBlockId,
        UUID toBlockId,
        String condition,
        OffsetDateTime createdAt
) {
}

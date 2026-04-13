package com.ms.executionservice.workflow.dto;

import lombok.Builder;

import java.time.OffsetDateTime;
import java.util.UUID;

@Builder
public record WorkflowConnectionDTO(
        UUID id,
        UUID workflowId,
        UUID fromBlockId,
        UUID toBlockId,
        String condition,
        OffsetDateTime createdAt
) {
}

package com.ms.executionservice.execution.dto.response;

import com.ms.executionservice.execution.enumtype.ExecutionStatus;
import lombok.Builder;

import java.time.OffsetDateTime;
import java.util.UUID;

@Builder
public record ExecutionShortResponse(
        UUID id,
        UUID workflowId,
        ExecutionStatus status,
        OffsetDateTime startedAt,
        OffsetDateTime finishedAt,
        OffsetDateTime createdAt
) {
}

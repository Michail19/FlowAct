package com.ms.executionservice.execution.dto.response;

import com.ms.executionservice.execution.enumtype.ExecutionStatus;
import lombok.Builder;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Builder
public record ExecutionResponse(
        UUID id,
        UUID workflowId,
        UUID startedByUserId,
        ExecutionStatus status,
        Map<String, Object> inputData,
        Map<String, Object> outputData,
        String errorMessage,
        OffsetDateTime startedAt,
        OffsetDateTime finishedAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}

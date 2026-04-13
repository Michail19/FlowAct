package com.ms.executionservice.execution.dto.response;

import com.ms.executionservice.execution.enumtype.ExecutionLogStatus;
import lombok.Builder;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Builder
public record ExecutionLogResponse(
        UUID id,
        UUID executionId,
        UUID blockId,
        ExecutionLogStatus status,
        Map<String, Object> output,
        String error,
        OffsetDateTime createdAt
) {
}

package com.ms.executionservice.workflow.dto.response;

import com.ms.executionservice.workflow.enumtype.BlockType;
import lombok.Builder;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Builder
public record WorkflowBlockResponse(
        UUID id,
        UUID workflowId,
        BlockType type,
        String name,
        Map<String, Object> position,
        Map<String, Object> config,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}

package com.ms.executionservice.workflow.dto.response;

import com.ms.executionservice.workflow.enumtype.WorkflowStatus;
import lombok.Builder;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Builder
public record WorkflowResponse(
        UUID id,
        UUID notebookId,
        String name,
        String description,
        WorkflowStatus status,
        List<WorkflowBlockResponse> blocks,
        List<WorkflowConnectionResponse> connections,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}

package com.ms.executionservice.workflow.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Builder;

import java.util.UUID;

@Builder
public record WorkflowConnectionRequest(
        UUID id,
        @NotNull UUID fromBlockId,
        @NotNull UUID toBlockId,
        String condition
) {
}

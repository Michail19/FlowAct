package com.ms.executionservice.workflow.dto.request;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record WorkflowConnectionRequest(
        UUID id,

        @NotNull
        UUID fromBlockId,

        @NotNull
        UUID toBlockId,

        String condition
) {
}

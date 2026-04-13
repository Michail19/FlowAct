package com.ms.executionservice.execution.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Builder;

import java.util.Map;
import java.util.UUID;

@Builder
public record CreateExecutionRequest(

        @NotNull
        UUID workflowId,

        Map<String, Object> inputData
) {
}

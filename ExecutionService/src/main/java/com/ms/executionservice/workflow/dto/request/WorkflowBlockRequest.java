package com.ms.executionservice.workflow.dto.request;

import com.ms.executionservice.workflow.enumtype.BlockType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;

import java.util.Map;
import java.util.UUID;

@Builder
public record WorkflowBlockRequest(
        UUID id,
        @NotNull BlockType type,
        @NotBlank String name,
        Map<String, Object> position,
        Map<String, Object> config
) {
}

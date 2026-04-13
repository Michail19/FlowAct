package com.ms.executionservice.execution.dto.request;

import lombok.Builder;

import java.util.Map;

@Builder
public record CreateExecutionRequest(
        Map<String, Object> inputData
) {
}

package com.ms.executionservice.execution.dto.request;

import lombok.Builder;

@Builder
public record ResumeExecutionRequest(
        Object resumePayload
) {
}

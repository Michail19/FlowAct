package com.ms.executionservice.workflow.dto.response;

import java.util.List;

public record WorkflowValidationResponse(
        boolean valid,
        List<String> errors,
        List<String> warnings
) {}

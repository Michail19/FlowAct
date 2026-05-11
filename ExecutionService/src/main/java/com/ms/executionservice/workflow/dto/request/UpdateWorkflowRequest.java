package com.ms.executionservice.workflow.dto.request;

import jakarta.validation.constraints.NotBlank;

import java.util.List;
import java.util.Map;

public record UpdateWorkflowRequest(
        @NotBlank String name,
        String description,
        Map<String, Object> metadata,
        List<WorkflowBlockRequest> blocks,
        List<WorkflowConnectionRequest> connections
) {}

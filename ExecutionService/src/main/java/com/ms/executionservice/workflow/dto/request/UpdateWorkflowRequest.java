package com.ms.executionservice.workflow.dto.request;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record UpdateWorkflowRequest(
        @NotBlank String name,
        String description,
        List<WorkflowBlockRequest> blocks,
        List<WorkflowConnectionRequest> connections
) {}

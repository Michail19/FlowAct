package com.ms.executionservice.workflow.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record CreateWorkflowRequest(
        @NotNull UUID notebookId,
        @NotBlank String name,
        String description,
        @NotNull List<WorkflowBlockRequest> blocks,
        @NotNull List<WorkflowConnectionRequest> connections
) {}

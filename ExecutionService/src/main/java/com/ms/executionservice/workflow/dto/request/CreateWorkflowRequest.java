package com.ms.executionservice.workflow.dto.request;

import com.ms.executionservice.workflow.dto.WorkflowBlockDTO;
import com.ms.executionservice.workflow.dto.WorkflowConnectionDTO;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record CreateWorkflowRequest(
        @NotNull UUID notebookId,
        @NotBlank String name,
        String description,
        @NotNull List<WorkflowBlockDTO> blocks,
        @NotNull List<WorkflowConnectionDTO> connections
) {}

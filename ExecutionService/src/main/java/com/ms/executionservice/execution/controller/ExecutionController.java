package com.ms.executionservice.execution.controller;

import com.ms.executionservice.execution.dto.request.CreateExecutionRequest;
import com.ms.executionservice.execution.dto.request.ResumeExecutionRequest;
import com.ms.executionservice.execution.dto.response.ExecutionLogResponse;
import com.ms.executionservice.execution.dto.response.ExecutionResponse;
import com.ms.executionservice.execution.service.ExecutionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notebooks/{notebookId}/workflows/{workflowId}")
public class ExecutionController {

    private final ExecutionService executionService;

    public ExecutionController(ExecutionService executionService) {
        this.executionService = executionService;
    }

    @PostMapping("/executions")
    @ResponseStatus(HttpStatus.CREATED)
    public ExecutionResponse run(
            @PathVariable UUID notebookId,
            @PathVariable UUID workflowId,
            @RequestHeader("X-User-Id") UUID currentUserId,
            @Valid @RequestBody CreateExecutionRequest request
    ) {
        return executionService.run(notebookId, workflowId, request, currentUserId);
    }

    @GetMapping("/executions")
    public List<ExecutionResponse> getExecutionsByWorkflow(
            @PathVariable UUID notebookId,
            @PathVariable UUID workflowId
    ) {
        return executionService.getExecutionsByWorkflow(notebookId, workflowId);
    }

    @GetMapping("/executions/{executionId}")
    public ExecutionResponse getById(
            @PathVariable UUID notebookId,
            @PathVariable UUID workflowId,
            @PathVariable UUID executionId
    ) {
        return executionService.getById(notebookId, workflowId, executionId);
    }

    @GetMapping("/executions/{executionId}/logs")
    public List<ExecutionLogResponse> getLogs(
            @PathVariable UUID notebookId,
            @PathVariable UUID workflowId,
            @PathVariable UUID executionId
    ) {
        return executionService.getLogs(notebookId, workflowId, executionId);
    }

    @PostMapping("/executions/{executionId}/retry")
    public ExecutionResponse retry(
            @PathVariable UUID notebookId,
            @PathVariable UUID workflowId,
            @PathVariable UUID executionId
    ) {
        return executionService.retry(notebookId, workflowId, executionId);
    }

    @PostMapping("/executions/{executionId}/resume")
    public ExecutionResponse resume(
            @PathVariable UUID notebookId,
            @PathVariable UUID workflowId,
            @PathVariable UUID executionId,
            @RequestBody ResumeExecutionRequest request
    ) {
        return executionService.resume(
                notebookId,
                workflowId,
                executionId,
                request != null ? request.resumePayload() : null
        );
    }

    @PostMapping("/executions/{executionId}/cancel")
    public ExecutionResponse cancel(
            @PathVariable UUID notebookId,
            @PathVariable UUID workflowId,
            @PathVariable UUID executionId
    ) {
        return executionService.cancel(notebookId, workflowId, executionId);
    }
}

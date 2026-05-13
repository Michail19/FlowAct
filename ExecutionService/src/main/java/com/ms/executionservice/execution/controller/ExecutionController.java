package com.ms.executionservice.execution.controller;

import com.ms.executionservice.execution.dto.request.CreateExecutionRequest;
import com.ms.executionservice.execution.dto.request.ResumeExecutionRequest;
import com.ms.executionservice.execution.dto.response.ExecutionLogResponse;
import com.ms.executionservice.execution.dto.response.ExecutionResponse;
import com.ms.executionservice.execution.service.ExecutionService;
import com.ms.executionservice.security.util.CurrentUserUtils;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
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
            Authentication authentication,
            @PathVariable UUID notebookId,
            @PathVariable UUID workflowId,
            @Valid @RequestBody CreateExecutionRequest request
    ) {
        UUID currentUserId = CurrentUserUtils.getCurrentUserId(authentication);
        return executionService.run(currentUserId, notebookId, workflowId, request);
    }

    @GetMapping("/executions")
    public List<ExecutionResponse> getExecutionsByWorkflow(
            Authentication authentication,
            @PathVariable UUID notebookId,
            @PathVariable UUID workflowId
    ) {
        UUID currentUserId = CurrentUserUtils.getCurrentUserId(authentication);
        return executionService.getExecutionsByWorkflow(currentUserId, notebookId, workflowId);
    }

    @GetMapping("/executions/{executionId}")
    public ExecutionResponse getById(
            Authentication authentication,
            @PathVariable UUID notebookId,
            @PathVariable UUID workflowId,
            @PathVariable UUID executionId
    ) {
        UUID currentUserId = CurrentUserUtils.getCurrentUserId(authentication);
        return executionService.getById(currentUserId, notebookId, workflowId, executionId);
    }

    @GetMapping("/executions/{executionId}/logs")
    public List<ExecutionLogResponse> getLogs(
            Authentication authentication,
            @PathVariable UUID notebookId,
            @PathVariable UUID workflowId,
            @PathVariable UUID executionId
    ) {
        UUID currentUserId = CurrentUserUtils.getCurrentUserId(authentication);
        return executionService.getLogs(currentUserId, notebookId, workflowId, executionId);
    }

    @PostMapping("/executions/{executionId}/retry")
    public ExecutionResponse retry(
            Authentication authentication,
            @PathVariable UUID notebookId,
            @PathVariable UUID workflowId,
            @PathVariable UUID executionId
    ) {
        UUID currentUserId = CurrentUserUtils.getCurrentUserId(authentication);
        return executionService.retry(currentUserId, notebookId, workflowId, executionId);
    }

    @PostMapping("/executions/{executionId}/resume")
    public ExecutionResponse resume(
            Authentication authentication,
            @PathVariable UUID notebookId,
            @PathVariable UUID workflowId,
            @PathVariable UUID executionId,
            @RequestBody ResumeExecutionRequest request
    ) {
        UUID currentUserId = CurrentUserUtils.getCurrentUserId(authentication);
        return executionService.resume(
                currentUserId,
                notebookId,
                workflowId,
                executionId,
                request != null ? request.resumePayload() : null
        );
    }

    @PostMapping("/executions/{executionId}/cancel")
    public ExecutionResponse cancel(
            Authentication authentication,
            @PathVariable UUID notebookId,
            @PathVariable UUID workflowId,
            @PathVariable UUID executionId
    ) {
        UUID currentUserId = CurrentUserUtils.getCurrentUserId(authentication);
        return executionService.cancel(currentUserId, notebookId, workflowId, executionId);
    }
}

package com.ms.executionservice.workflow.controller;

import com.ms.executionservice.security.util.CurrentUserUtils;
import com.ms.executionservice.workflow.dto.request.CreateWorkflowRequest;
import com.ms.executionservice.workflow.dto.request.UpdateWorkflowRequest;
import com.ms.executionservice.workflow.dto.response.WorkflowResponse;
import com.ms.executionservice.workflow.dto.response.WorkflowShortResponse;
import com.ms.executionservice.workflow.dto.response.WorkflowValidationResponse;
import com.ms.executionservice.workflow.service.WorkflowService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;


@RestController
@RequestMapping("/api/v1/notebooks/{notebookId}/workflows")
public class WorkflowController {

    private final WorkflowService workflowService;

    public WorkflowController(WorkflowService workflowService) {
        this.workflowService = workflowService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WorkflowResponse create(
            Authentication authentication,
            @PathVariable UUID notebookId,
            @Valid @RequestBody CreateWorkflowRequest request
    ) {
        UUID userId = CurrentUserUtils.getCurrentUserId(authentication);
        return workflowService.create(userId, notebookId, request);
    }

    @GetMapping("/{workflowId}")
    public WorkflowResponse getById(
            Authentication authentication,
            @PathVariable UUID notebookId,
            @PathVariable UUID workflowId
    ) {
        UUID userId = CurrentUserUtils.getCurrentUserId(authentication);
        return workflowService.getById(userId, notebookId, workflowId);
    }

    @PutMapping("/{workflowId}")
    public WorkflowResponse update(
            Authentication authentication,
            @PathVariable UUID notebookId,
            @PathVariable UUID workflowId,
            @Valid @RequestBody UpdateWorkflowRequest request
    ) {
        UUID userId = CurrentUserUtils.getCurrentUserId(authentication);
        return workflowService.update(userId, notebookId, workflowId, request);
    }

    @PostMapping("/{workflowId}/validate")
    public WorkflowValidationResponse validate(
            Authentication authentication,
            @PathVariable UUID notebookId,
            @PathVariable UUID workflowId
    ) {
        UUID userId = CurrentUserUtils.getCurrentUserId(authentication);
        return workflowService.validate(userId, notebookId, workflowId);
    }

    @PostMapping("/{workflowId}/activate")
    public WorkflowResponse activate(
            Authentication authentication,
            @PathVariable UUID notebookId,
            @PathVariable UUID workflowId
    ) {
        UUID userId = CurrentUserUtils.getCurrentUserId(authentication);
        return workflowService.activate(userId, notebookId, workflowId);
    }

    @PostMapping("/{workflowId}/archive")
    public WorkflowResponse archive(
            Authentication authentication,
            @PathVariable UUID notebookId,
            @PathVariable UUID workflowId
    ) {
        UUID userId = CurrentUserUtils.getCurrentUserId(authentication);
        return workflowService.archive(userId, notebookId, workflowId);
    }

    @GetMapping
    public List<WorkflowShortResponse> getAll(
            Authentication authentication,
            @PathVariable UUID notebookId
    ) {
        UUID userId = CurrentUserUtils.getCurrentUserId(authentication);
        return workflowService.getAll(userId, notebookId);
    }
}

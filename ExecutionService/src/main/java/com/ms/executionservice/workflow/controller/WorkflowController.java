package com.ms.executionservice.workflow.controller;

import com.ms.executionservice.workflow.dto.request.CreateWorkflowRequest;
import com.ms.executionservice.workflow.dto.request.UpdateWorkflowRequest;
import com.ms.executionservice.workflow.dto.response.WorkflowResponse;
import com.ms.executionservice.workflow.dto.response.WorkflowShortResponse;
import com.ms.executionservice.workflow.dto.response.WorkflowValidationResponse;
import com.ms.executionservice.workflow.service.WorkflowService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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
            @PathVariable UUID notebookId,
            @Valid @RequestBody CreateWorkflowRequest request
    ) {
        return workflowService.create(notebookId, request);
    }

    @GetMapping("/{workflowId}")
    public WorkflowResponse getById(@PathVariable UUID notebookId, @PathVariable UUID workflowId) {
        return workflowService.getById(notebookId, workflowId);
    }

    @PutMapping("/{workflowId}")
    public WorkflowResponse update(
            @PathVariable UUID notebookId,
            @PathVariable UUID workflowId,
            @Valid @RequestBody UpdateWorkflowRequest request
    ) {
        return workflowService.update(notebookId, workflowId, request);
    }

    @PostMapping("/{workflowId}/validate")
    public WorkflowValidationResponse validate(@PathVariable UUID notebookId, @PathVariable UUID workflowId) {
        return workflowService.validate(notebookId, workflowId);
    }

    @PostMapping("/{workflowId}/activate")
    public WorkflowResponse activate(@PathVariable UUID notebookId, @PathVariable UUID workflowId) {
        return workflowService.activate(notebookId, workflowId);
    }

    @PostMapping("/{workflowId}/archive")
    public WorkflowResponse archive(@PathVariable UUID notebookId, @PathVariable UUID workflowId) {
        return workflowService.archive(notebookId, workflowId);
    }

    @GetMapping
    public List<WorkflowShortResponse> getAll(@PathVariable UUID notebookId) {
        return workflowService.getAll(notebookId);
    }
}

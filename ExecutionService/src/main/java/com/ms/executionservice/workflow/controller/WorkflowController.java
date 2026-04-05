package com.ms.executionservice.workflow.controller;

import com.ms.executionservice.workflow.dto.response.WorkflowResponse;
import com.ms.executionservice.workflow.service.WorkflowService;
import jakarta.validation.Valid;
import org.hibernate.validator.constraints.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/workflows")
public class WorkflowController {

    private final WorkflowService workflowService;

    public WorkflowController(WorkflowService workflowService) {
        this.workflowService = workflowService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WorkflowService create(@Valid @RequestBody CreateWorkflowRequest request) {
        return workflowService.create(request);
    }

    @GetMapping("/{id}")
    public WorkflowResponse getById(@PathVariable UUID id) {
        return workflowService.getById(id);
    }

    @PutMapping("/{id}")
    public WorkflowResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateWorkflowRequest request
    ) {
        return workflowService.update(id, request);
    }

    @PostMapping("/{id}/validate")
    public WorkflowValidationResponse validate(@PathVariable UUID id) {
        return workflowService.validate(id);
    }

    @PostMapping("/{id}/activate")
    public WorkflowResponse activate(@PathVariable UUID id) {
        return workflowService.activate(id);
    }

    @GetMapping
    public List<WorkflowResponse> getAll() {
        return workflowService.getAll();
    }
}

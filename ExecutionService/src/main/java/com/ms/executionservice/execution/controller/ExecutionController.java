package com.ms.executionservice.execution.controller;

import com.ms.executionservice.execution.dto.response.ExecutionResponse;
import com.ms.executionservice.execution.service.ExecutionService;
import jakarta.validation.Valid;
import org.hibernate.validator.constraints.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class ExecutionController {

    private final ExecutionService executionService;

    public ExecutionController(ExecutionService executionService) {
        this.executionService = executionService;
    }

    @PostMapping("/worflows/{workflowId}/executions")
    @ResponseStatus(HttpStatus.CREATED)
    public ExecutionResponse run(
            @PathVariable UUID workflowId,
            @Valid @RequestBody RunExecutionRequest request
    ) {
        return executionService.run(workflowId, request);
    }

    @GetMapping("/executions/{executionId}")
    public ExecutionResponse getById(@PathVariable UUID executionId) {
        return executionService.getById(executionId);
    }

    @GetMapping("/executions/{executionId}/nodes")
    public List<NodeExecutionResponse> getNodeExecutions(@PathVariable UUID executionId) {
        return executionService.getNodeExecutions(executionId);
    }

    @PostMapping("/executions/{executionId}/retry")
    public ExecutionResponse retry(@PathVariable UUID executionId) {
        return executionService.retry(executionId);
    }

    @PostMapping("/executions/{executionId}/cancel")
    public ExecutionResponse cancel(@PathVariable UUID executionId) {
        return executionService.cancel(executionId);
    }
}

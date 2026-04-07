package com.ms.executionservice.execution.service;

import com.ms.executionservice.execution.dto.request.CreateExecutionRequest;
import com.ms.executionservice.execution.dto.response.ExecutionLogResponse;
import com.ms.executionservice.execution.dto.response.ExecutionResponse;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class ExecutionService {

    public ExecutionResponse run(
            UUID notebookId,
            UUID workflowId,
            CreateExecutionRequest request
    ) {}

    public ExecutionResponse getById(
            UUID notebookId,
            UUID workflowId,
            UUID executionId
    ) {}

    public List<ExecutionLogResponse> getLogs(
            UUID notebookId,
            UUID workflowId,
            UUID executionId
    ) {}

    public List<ExecutionResponse> getExecutionsByWorkflow(
            UUID notebookId,
            UUID workflowId
    ) {}

    public ExecutionResponse retry(
            UUID notebookId,
            UUID workflowId,
            UUID executionId
    ) {}

    public ExecutionResponse cancel(
            UUID notebookId,
            UUID workflowId,
            UUID executionId
    ) {}
}

package com.ms.executionservice.execution.service;

import com.ms.executionservice.execution.dto.request.CreateExecutionRequest;
import com.ms.executionservice.execution.dto.response.ExecutionLogResponse;
import com.ms.executionservice.execution.dto.response.ExecutionResponse;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class ExecutionService {

    public ExecutionResponse run(UUID workflowId, CreateExecutionRequest request) {}

    public ExecutionResponse getById(UUID executionId) {}

    public List<ExecutionLogResponse> getLogs(UUID executionId) {}

    public List<ExecutionResponse> getExecutionsByWorkflow(UUID workflowId) {}

    public ExecutionResponse retry(UUID executionId) {}

    public ExecutionResponse cancel(UUID executionId) {}
}

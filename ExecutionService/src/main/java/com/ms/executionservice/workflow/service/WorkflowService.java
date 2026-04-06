package com.ms.executionservice.workflow.service;

import com.ms.executionservice.workflow.dto.request.CreateWorkflowRequest;
import com.ms.executionservice.workflow.dto.request.UpdateWorkflowRequest;
import com.ms.executionservice.workflow.dto.response.WorkflowResponse;
import com.ms.executionservice.workflow.dto.response.WorkflowValidationResponse;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class WorkflowService {

    public WorkflowResponse create(CreateWorkflowRequest request) {}

    public WorkflowResponse getById(UUID workflowId) {}

    public List<WorkflowResponse> getAll() {}

    public WorkflowResponse update(UUID workflowId, UpdateWorkflowRequest request) {}

    public WorkflowValidationResponse validate(UUID workflowId) {}

    public WorkflowResponse activate(UUID workflowId) {}

    public WorkflowResponse archive(UUID workflowId) {}
}

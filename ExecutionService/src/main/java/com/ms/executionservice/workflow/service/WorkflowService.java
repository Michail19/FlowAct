package com.ms.executionservice.workflow.service;

import com.ms.executionservice.common.exception.EntityNotFoundException;
import com.ms.executionservice.workflow.dto.request.CreateWorkflowRequest;
import com.ms.executionservice.workflow.dto.request.UpdateWorkflowRequest;
import com.ms.executionservice.workflow.dto.response.WorkflowResponse;
import com.ms.executionservice.workflow.dto.response.WorkflowValidationResponse;
import com.ms.executionservice.workflow.entity.NotebookEntity;
import com.ms.executionservice.workflow.repository.NotebookRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class WorkflowService {
    private final NotebookRepository notebookRepository;

    public WorkflowService(NotebookRepository notebookRepository) {
        this.notebookRepository = notebookRepository;
    }

    public WorkflowResponse create(CreateWorkflowRequest request) {
        NotebookEntity notebook = notebookRepository.findById(request.notebookId())
                .orElseThrow(() -> new EntityNotFoundException("Notebook not found"));

        if (request.blocks().isEmpty()) {
            throw new IllegalArgumentException("Workflow must contain at least one block");
        }

        WorkflowResponse response = new WorkflowResponse();

        return response;
    }

    public WorkflowResponse getById(UUID workflowId) {}

    public List<WorkflowResponse> getAll() {}

    public WorkflowResponse update(UUID workflowId, UpdateWorkflowRequest request) {}

    public WorkflowValidationResponse validate(UUID workflowId) {}

    public WorkflowResponse activate(UUID workflowId) {}

    public WorkflowResponse archive(UUID workflowId) {}
}

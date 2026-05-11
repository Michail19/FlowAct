package com.ms.executionservice.notebooks.service;

import com.ms.executionservice.common.exception.EntityNotFoundException;
import com.ms.executionservice.execution.repository.ExecutionLogRepository;
import com.ms.executionservice.execution.repository.ExecutionRepository;
import com.ms.executionservice.notebooks.dto.request.CreateNotebookRequest;
import com.ms.executionservice.notebooks.dto.request.UpdateNotebookRequest;
import com.ms.executionservice.notebooks.dto.response.NotebookResponse;
import com.ms.executionservice.notebooks.dto.response.NotebookShortResponse;
import com.ms.executionservice.notebooks.entity.NotebookEntity;
import com.ms.executionservice.notebooks.repository.NotebookRepository;
import com.ms.executionservice.workflow.entity.WorkflowEntity;
import com.ms.executionservice.workflow.repository.WorkflowBlockRepository;
import com.ms.executionservice.workflow.repository.WorkflowConnectionRepository;
import com.ms.executionservice.workflow.repository.WorkflowRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class NotebookService {

    private final NotebookRepository notebookRepository;
    private final WorkflowRepository workflowRepository;
    private final WorkflowBlockRepository workflowBlockRepository;
    private final WorkflowConnectionRepository workflowConnectionRepository;
    private final ExecutionRepository executionRepository;
    private final ExecutionLogRepository executionLogRepository;

    public NotebookService(
            NotebookRepository notebookRepository,
            WorkflowRepository workflowRepository,
            WorkflowBlockRepository workflowBlockRepository,
            WorkflowConnectionRepository workflowConnectionRepository,
            ExecutionRepository executionRepository,
            ExecutionLogRepository executionLogRepository
    ) {
        this.notebookRepository = notebookRepository;
        this.workflowRepository = workflowRepository;
        this.workflowBlockRepository = workflowBlockRepository;
        this.workflowConnectionRepository = workflowConnectionRepository;
        this.executionRepository = executionRepository;
        this.executionLogRepository = executionLogRepository;
    }

    @Transactional
    public NotebookResponse create(UUID ownerUserId, CreateNotebookRequest request) {
        NotebookEntity notebook = NotebookEntity.builder()
                .id(UUID.randomUUID())
                .ownerUserId(ownerUserId)
                .name(request.name())
                .description(request.description())
                .build();

        notebook = notebookRepository.save(notebook);

        return mapToNotebookResponse(notebook);
    }

    @Transactional(readOnly = true)
    public NotebookResponse getById(UUID ownerUserId, UUID notebookId) {
        NotebookEntity notebook = findNotebookByOwner(ownerUserId, notebookId);
        return mapToNotebookResponse(notebook);
    }

    @Transactional(readOnly = true)
    public List<NotebookShortResponse> getAll(UUID ownerUserId) {
        return notebookRepository.findByOwnerUserId(ownerUserId)
                .stream()
                .map(this::mapToNotebookShortResponse)
                .toList();
    }

    @Transactional
    public NotebookResponse update(UUID ownerUserId, UUID notebookId, UpdateNotebookRequest request) {
        NotebookEntity notebook = findNotebookByOwner(ownerUserId, notebookId);

        notebook.setName(request.name());
        notebook.setDescription(request.description());

        notebook = notebookRepository.save(notebook);

        return mapToNotebookResponse(notebook);
    }

    @Transactional
    public void delete(UUID ownerUserId, UUID notebookId) {
        NotebookEntity notebook = findNotebookByOwner(ownerUserId, notebookId);

        List<WorkflowEntity> workflows = workflowRepository.findByNotebook_Id(notebookId);

        for (WorkflowEntity workflow : workflows) {
            executionLogRepository.deleteByExecution_Workflow_Id(workflow.getId());
            executionLogRepository.flush();

            executionRepository.deleteByWorkflow_Id(workflow.getId());
            executionRepository.flush();

            workflowConnectionRepository.deleteByWorkflow_Id(workflow.getId());
            workflowConnectionRepository.flush();

            workflowBlockRepository.deleteByWorkflow_Id(workflow.getId());
            workflowBlockRepository.flush();
        }

        workflowRepository.deleteAll(workflows);
        workflowRepository.flush();

        notebookRepository.delete(notebook);
        notebookRepository.flush();
    }

    private NotebookEntity findNotebookByOwner(UUID ownerUserId, UUID notebookId) {
        return notebookRepository.findByIdAndOwnerUserId(notebookId, ownerUserId)
                .orElseThrow(() -> new EntityNotFoundException("Notebook not found"));
    }

    private NotebookResponse mapToNotebookResponse(NotebookEntity notebook) {
        return NotebookResponse.builder()
                .id(notebook.getId())
                .ownerUserId(notebook.getOwnerUserId())
                .name(notebook.getName())
                .description(notebook.getDescription())
                .createdAt(notebook.getCreatedAt())
                .updatedAt(notebook.getUpdatedAt())
                .build();
    }

    private NotebookShortResponse mapToNotebookShortResponse(NotebookEntity notebook) {
        return NotebookShortResponse.builder()
                .id(notebook.getId())
                .ownerUserId(notebook.getOwnerUserId())
                .name(notebook.getName())
                .description(notebook.getDescription())
                .createdAt(notebook.getCreatedAt())
                .updatedAt(notebook.getUpdatedAt())
                .build();
    }
}

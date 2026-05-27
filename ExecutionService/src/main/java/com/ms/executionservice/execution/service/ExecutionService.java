package com.ms.executionservice.execution.service;

import com.ms.executionservice.common.exception.EntityNotFoundException;
import com.ms.executionservice.common.util.JsonUtils;
import com.ms.executionservice.execution.dto.request.CreateExecutionRequest;
import com.ms.executionservice.execution.dto.response.ExecutionLogResponse;
import com.ms.executionservice.execution.dto.response.ExecutionResponse;
import com.ms.executionservice.execution.entity.ExecutionEntity;
import com.ms.executionservice.execution.entity.ExecutionLogEntity;
import com.ms.executionservice.execution.enumtype.ExecutionStatus;
import com.ms.executionservice.execution.event.ExecutionCancelDispatchEvent;
import com.ms.executionservice.execution.event.ExecutionResumeDispatchEvent;
import com.ms.executionservice.execution.event.ExecutionRetryDispatchEvent;
import com.ms.executionservice.execution.event.ExecutionRunDispatchEvent;
import com.ms.executionservice.execution.repository.ExecutionLogRepository;
import com.ms.executionservice.execution.repository.ExecutionRepository;
import com.ms.executionservice.notebooks.repository.NotebookRepository;
import com.ms.executionservice.workflow.entity.WorkflowEntity;
import com.ms.executionservice.workflow.enumtype.WorkflowStatus;
import com.ms.executionservice.workflow.repository.WorkflowRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class ExecutionService {

    private final NotebookRepository notebookRepository;
    private final WorkflowRepository workflowRepository;
    private final ExecutionRepository executionRepository;
    private final ExecutionLogRepository executionLogRepository;
    private final JsonUtils jsonUtils;
    private final ExecutionDispatchService executionDispatchService;

    public ExecutionService(
            NotebookRepository notebookRepository,
            WorkflowRepository workflowRepository,
            ExecutionRepository executionRepository,
            ExecutionLogRepository executionLogRepository,
            JsonUtils jsonUtils,
            ExecutionDispatchService executionDispatchService
    ) {
        this.notebookRepository = notebookRepository;
        this.workflowRepository = workflowRepository;
        this.executionRepository = executionRepository;
        this.executionLogRepository = executionLogRepository;
        this.jsonUtils = jsonUtils;
        this.executionDispatchService = executionDispatchService;
    }

    @Transactional
    public ExecutionResponse run(
            UUID currentUserId,
            UUID notebookId,
            UUID workflowId,
            CreateExecutionRequest request
    ) {
        WorkflowEntity workflow = findWorkflowInUserNotebook(currentUserId, notebookId, workflowId);

        if (workflow.getStatus() == WorkflowStatus.ARCHIVED) {
            throw new IllegalStateException(
                    "Workflow находится в архиве и не может быть запущен"
            );
        }

        if (workflow.getStatus() != WorkflowStatus.ACTIVE) {
            throw new IllegalStateException(
                    "Workflow находится в статусе DRAFT. Сначала сохраните и активируйте схему."
            );
        }

        ExecutionEntity execution = ExecutionEntity.builder()
                .id(UUID.randomUUID())
                .workflow(workflow)
                .startedByUserId(currentUserId)
                .status(ExecutionStatus.PENDING)
                .inputData(jsonUtils.toJson(request.inputData()))
                .outputData(null)
                .errorMessage(null)
                .startedAt(null)
                .finishedAt(null)
                .build();

        execution = executionRepository.save(execution);

        executionDispatchService.publishRunRequested(
                execution.getId(),
                workflow.getId(),
                notebookId,
                currentUserId
        );

        return toResponse(execution);
    }

    @Transactional(readOnly = true)
    public ExecutionResponse getById(
            UUID currentUserId,
            UUID notebookId,
            UUID workflowId,
            UUID executionId
    ) {
        ExecutionEntity execution = findExecutionInUserWorkflow(
                currentUserId,
                notebookId,
                workflowId,
                executionId
        );

        return toResponse(execution);
    }

    @Transactional(readOnly = true)
    public List<ExecutionLogResponse> getLogs(
            UUID currentUserId,
            UUID notebookId,
            UUID workflowId,
            UUID executionId
    ) {
        ExecutionEntity execution = findExecutionInUserWorkflow(
                currentUserId,
                notebookId,
                workflowId,
                executionId
        );

        return executionLogRepository.findByExecution_IdOrderByCreatedAtAsc(execution.getId())
                .stream()
                .map(this::toLogResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ExecutionResponse> getExecutionsByWorkflow(
            UUID currentUserId,
            UUID notebookId,
            UUID workflowId
    ) {
        findWorkflowInUserNotebook(currentUserId, notebookId, workflowId);

        return executionRepository.findByWorkflow_IdOrderByCreatedAtDesc(workflowId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ExecutionResponse retry(
            UUID currentUserId,
            UUID notebookId,
            UUID workflowId,
            UUID executionId
    ) {
        ExecutionEntity oldExecution = findExecutionInUserWorkflow(
                currentUserId,
                notebookId,
                workflowId,
                executionId
        );

        if (oldExecution.getStatus() != ExecutionStatus.SUCCESS
                && oldExecution.getStatus() != ExecutionStatus.FAILED
                && oldExecution.getStatus() != ExecutionStatus.CANCELLED) {
            throw new IllegalStateException(
                    "Execution can be retried only after SUCCESS, FAILED or CANCELLED"
            );
        }

        ExecutionEntity newExecution = ExecutionEntity.builder()
                .id(UUID.randomUUID())
                .workflow(oldExecution.getWorkflow())
                .startedByUserId(currentUserId)
                .status(ExecutionStatus.PENDING)
                .inputData(oldExecution.getInputData())
                .outputData(null)
                .errorMessage(null)
                .startedAt(null)
                .finishedAt(null)
                .build();

        newExecution = executionRepository.save(newExecution);

        executionDispatchService.publishRetryRequested(
                oldExecution.getId(),
                newExecution.getId(),
                oldExecution.getWorkflow().getId(),
                notebookId,
                currentUserId
        );

        return toResponse(newExecution);
    }

    @Transactional
    public ExecutionResponse resume(
            UUID currentUserId,
            UUID notebookId,
            UUID workflowId,
            UUID executionId,
            Object resumePayload
    ) {
        ExecutionEntity execution = findExecutionInUserWorkflow(
                currentUserId,
                notebookId,
                workflowId,
                executionId
        );

        if (execution.getStatus() != ExecutionStatus.WAITING) {
            throw new IllegalStateException("Execution is not in WAITING state");
        }

        executionDispatchService.publishResumeRequested(
                execution.getId(),
                workflowId,
                notebookId,
                resumePayload
        );

        return toResponse(execution);
    }

    @Transactional
    public ExecutionResponse cancel(
            UUID currentUserId,
            UUID notebookId,
            UUID workflowId,
            UUID executionId
    ) {
        ExecutionEntity execution = findExecutionInUserWorkflow(
                currentUserId,
                notebookId,
                workflowId,
                executionId
        );

        if (execution.getStatus() == ExecutionStatus.SUCCESS
                || execution.getStatus() == ExecutionStatus.FAILED
                || execution.getStatus() == ExecutionStatus.CANCELLED) {
            return toResponse(execution);
        }

        if (execution.getStatus() == ExecutionStatus.PENDING) {
            execution.setStatus(ExecutionStatus.CANCELLED);
            execution.setFinishedAt(java.time.OffsetDateTime.now());
            execution = executionRepository.save(execution);
            return toResponse(execution);
        }

        if (execution.getStatus() == ExecutionStatus.RUNNING
                || execution.getStatus() == ExecutionStatus.WAITING
                || execution.getStatus() == ExecutionStatus.READY
                || execution.getStatus() == ExecutionStatus.VALIDATING
                || execution.getStatus() == ExecutionStatus.CREATED) {

            execution.setStatus(ExecutionStatus.CANCELLING);
            execution = executionRepository.save(execution);

            executionDispatchService.publishCancelRequested(
                    execution.getId(),
                    execution.getWorkflow().getId(),
                    notebookId
            );

            return toResponse(execution);
        }

        if (execution.getStatus() == ExecutionStatus.CANCELLING) {
            return toResponse(execution);
        }

        throw new IllegalStateException("Execution cannot be cancelled");
    }

    private WorkflowEntity findWorkflowInUserNotebook(
            UUID currentUserId,
            UUID notebookId,
            UUID workflowId
    ) {
        if (!notebookRepository.existsByIdAndOwnerUserId(notebookId, currentUserId)) {
            throw new EntityNotFoundException("Notebook not found");
        }

        return workflowRepository.findByIdAndNotebook_Id(workflowId, notebookId)
                .orElseThrow(() -> new EntityNotFoundException("Workflow not found"));
    }

    private ExecutionEntity findExecutionInUserWorkflow(
            UUID currentUserId,
            UUID notebookId,
            UUID workflowId,
            UUID executionId
    ) {
        findWorkflowInUserNotebook(currentUserId, notebookId, workflowId);

        return executionRepository
                .findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(executionId, workflowId, notebookId)
                .orElseThrow(() -> new EntityNotFoundException("Execution not found"));
    }

    private ExecutionResponse toResponse(ExecutionEntity entity) {
        return ExecutionResponse.builder()
                .id(entity.getId())
                .workflowId(entity.getWorkflow().getId())
                .startedByUserId(entity.getStartedByUserId())
                .status(entity.getStatus())
                .inputData(jsonUtils.toMap(entity.getInputData()))
                .outputData(jsonUtils.toMap(entity.getOutputData()))
                .errorMessage(entity.getErrorMessage())
                .startedAt(entity.getStartedAt())
                .finishedAt(entity.getFinishedAt())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private ExecutionLogResponse toLogResponse(ExecutionLogEntity entity) {
        return ExecutionLogResponse.builder()
                .id(entity.getId())
                .executionId(entity.getExecution().getId())
                .blockId(entity.getBlock().getId())
                .status(entity.getStatus())
                .input(jsonUtils.toMap(entity.getInput()))
                .output(jsonUtils.toMap(entity.getOutput()))
                .error(entity.getError())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}

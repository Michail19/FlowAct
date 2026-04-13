package com.ms.executionservice.execution.service;

import com.ms.executionservice.common.exception.EntityNotFoundException;
import com.ms.executionservice.common.util.JsonUtils;
import com.ms.executionservice.execution.dto.request.CreateExecutionRequest;
import com.ms.executionservice.execution.dto.response.ExecutionLogResponse;
import com.ms.executionservice.execution.dto.response.ExecutionResponse;
import com.ms.executionservice.execution.entity.ExecutionEntity;
import com.ms.executionservice.execution.entity.ExecutionLogEntity;
import com.ms.executionservice.execution.enumtype.ExecutionStatus;
import com.ms.executionservice.execution.repository.ExecutionLogRepository;
import com.ms.executionservice.execution.repository.ExecutionRepository;
import com.ms.executionservice.workflow.entity.WorkflowEntity;
import com.ms.executionservice.workflow.enumtype.WorkflowStatus;
import com.ms.executionservice.workflow.repository.WorkflowRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class ExecutionService {

    private final WorkflowRepository workflowRepository;
    private final ExecutionRepository executionRepository;
    private final ExecutionLogRepository executionLogRepository;
    private final JsonUtils jsonUtils;
    private final ExecutionDispatchService executionDispatchService;

    public ExecutionService(
            WorkflowRepository workflowRepository,
            ExecutionRepository executionRepository,
            ExecutionLogRepository executionLogRepository,
            JsonUtils jsonUtils,
            ExecutionDispatchService executionDispatchService
    ) {
        this.workflowRepository = workflowRepository;
        this.executionRepository = executionRepository;
        this.executionLogRepository = executionLogRepository;
        this.jsonUtils = jsonUtils;
        this.executionDispatchService = executionDispatchService;
    }

    @Transactional
    public ExecutionResponse run(
            UUID notebookId,
            UUID workflowId,
            CreateExecutionRequest request,
            UUID currentUserId
    ) {
        WorkflowEntity workflow = workflowRepository.findByIdAndNotebook_Id(workflowId, notebookId)
                .orElseThrow(() -> new EntityNotFoundException("Workflow not found"));

        if (workflow.getStatus() != WorkflowStatus.ACTIVE) {
            throw new IllegalStateException("Workflow is not active");
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
            UUID notebookId,
            UUID workflowId,
            UUID executionId
    ) {
        ExecutionEntity execution = executionRepository
                .findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(executionId, workflowId, notebookId)
                .orElseThrow(() -> new EntityNotFoundException("Execution not found"));

        return toResponse(execution);
    }

    @Transactional(readOnly = true)
    public List<ExecutionLogResponse> getLogs(
            UUID notebookId,
            UUID workflowId,
            UUID executionId
    ) {
        ExecutionEntity execution = executionRepository
                .findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(executionId, workflowId, notebookId)
                .orElseThrow(() -> new EntityNotFoundException("Execution not found"));

        return executionLogRepository.findByExecution_IdOrderByCreatedAtAsc(execution.getId())
                .stream()
                .map(this::toLogResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ExecutionResponse> getExecutionsByWorkflow(
            UUID notebookId,
            UUID workflowId
    ) {
        workflowRepository.findByIdAndNotebook_Id(workflowId, notebookId)
                .orElseThrow(() -> new EntityNotFoundException("Workflow not found"));

        return executionRepository.findByWorkflow_IdOrderByCreatedAtDesc(workflowId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ExecutionResponse retry(
            UUID notebookId,
            UUID workflowId,
            UUID executionId
    ) {
        ExecutionEntity oldExecution = executionRepository
                .findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(executionId, workflowId, notebookId)
                .orElseThrow(() -> new EntityNotFoundException("Execution not found"));

        if (oldExecution.getStatus() != ExecutionStatus.FAILED
                && oldExecution.getStatus() != ExecutionStatus.CANCELLED) {
            throw new IllegalStateException("Execution cannot be retried");
        }

        ExecutionEntity newExecution = ExecutionEntity.builder()
                .id(UUID.randomUUID())
                .workflow(oldExecution.getWorkflow())
                .startedByUserId(oldExecution.getStartedByUserId())
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
                oldExecution.getStartedByUserId()
        );

        return toResponse(newExecution);
    }

    @Transactional
    public ExecutionResponse cancel(
            UUID notebookId,
            UUID workflowId,
            UUID executionId
    ) {
        ExecutionEntity execution = executionRepository
                .findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(executionId, workflowId, notebookId)
                .orElseThrow(() -> new EntityNotFoundException("Execution not found"));

        if (execution.getStatus() == ExecutionStatus.SUCCESS
                || execution.getStatus() == ExecutionStatus.FAILED
                || execution.getStatus() == ExecutionStatus.CANCELLED) {
            throw new IllegalStateException("Execution already finished");
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
                .output(jsonUtils.toMap(entity.getOutput()))
                .error(entity.getError())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}

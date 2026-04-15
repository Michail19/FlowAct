package com.ms.workerservice.execution.service;

import com.ms.workerservice.execution.entity.ExecutionEntity;
import com.ms.workerservice.execution.entity.ExecutionLogEntity;
import com.ms.workerservice.execution.enumtype.ExecutionLogStatus;
import com.ms.workerservice.execution.enumtype.ExecutionStatus;
import com.ms.workerservice.execution.event.ExecutionRunRequestedEvent;
import com.ms.workerservice.execution.repository.ExecutionLogRepository;
import com.ms.workerservice.execution.repository.ExecutionRepository;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.entity.WorkflowConnectionEntity;
import com.ms.workerservice.workflow.entity.WorkflowEntity;
import com.ms.workerservice.workflow.repository.WorkflowBlockRepository;
import com.ms.workerservice.workflow.repository.WorkflowConnectionRepository;
import com.ms.workerservice.workflow.repository.WorkflowRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class ExecutionWorkerService {

    private final ExecutionRepository executionRepository;
    private final ExecutionLogRepository executionLogRepository;
    private final WorkflowRepository workflowRepository;
    private final WorkflowBlockRepository workflowBlockRepository;
    private final WorkflowConnectionRepository workflowConnectionRepository;

    public ExecutionWorkerService(
            ExecutionRepository executionRepository,
            ExecutionLogRepository executionLogRepository,
            WorkflowRepository workflowRepository,
            WorkflowBlockRepository workflowBlockRepository,
            WorkflowConnectionRepository workflowConnectionRepository
    ) {
        this.executionRepository = executionRepository;
        this.executionLogRepository = executionLogRepository;
        this.workflowRepository = workflowRepository;
        this.workflowBlockRepository = workflowBlockRepository;
        this.workflowConnectionRepository = workflowConnectionRepository;
    }

    @Transactional
    public void handleRunRequested(ExecutionRunRequestedEvent event) {
        ExecutionEntity execution = executionRepository.findById(event.executionId())
                .orElseThrow(() -> new IllegalStateException("Execution not found: " + event.executionId()));

        // Идемпотентность: если execution уже обработан или взят в работу, второй раз не запускаем
        if (execution.getStatus() != ExecutionStatus.PENDING) {
            return;
        }

        WorkflowEntity workflow = workflowRepository.findById(event.workflowId())
                .orElseThrow(() -> new IllegalStateException("Workflow not found: " + event.workflowId()));

        List<WorkflowBlockEntity> blocks = workflowBlockRepository.findByWorkflow_Id(workflow.getId());
        List<WorkflowConnectionEntity> connections = workflowConnectionRepository.findByWorkflow_Id(workflow.getId());

        // Здесь позже будет нормальная валидация графа
        if (blocks.isEmpty()) {
            execution.setStatus(ExecutionStatus.FAILED);
            execution.setErrorMessage("Workflow contains no blocks");
            execution.setFinishedAt(OffsetDateTime.now());
            executionRepository.save(execution);
            return;
        }

        execution.setStatus(ExecutionStatus.RUNNING);
        execution.setStartedAt(OffsetDateTime.now());
        executionRepository.save(execution);

        try {
            runWorkflow(execution, workflow, blocks, connections);

            execution.setStatus(ExecutionStatus.SUCCESS);
            execution.setFinishedAt(OffsetDateTime.now());
            executionRepository.save(execution);

        } catch (Exception ex) {
            execution.setStatus(ExecutionStatus.FAILED);
            execution.setErrorMessage(ex.getMessage());
            execution.setFinishedAt(OffsetDateTime.now());
            executionRepository.save(execution);
        }
    }

    private void runWorkflow(
            ExecutionEntity execution,
            WorkflowEntity workflow,
            List<WorkflowBlockEntity> blocks,
            List<WorkflowConnectionEntity> connections
    ) {
        // Временная минимальная заглушка.
        // Позже сюда перенесём полноценный runner:
        // - buildGraph(...)
        // - validateGraph(...)
        // - resolve start node
        // - execute block handlers
        // - write logs
        // - compute next node

        for (WorkflowBlockEntity block : blocks) {
            ExecutionLogEntity logEntity = ExecutionLogEntity.builder()
                    .id(UUID.randomUUID())
                    .execution(execution)
                    .block(block)
                    .status(ExecutionLogStatus.SUCCESS)
                    .output(null)
                    .error(null)
                    .createdAt(OffsetDateTime.now())
                    .build();

            executionLogRepository.save(logEntity);
        }
    }
}

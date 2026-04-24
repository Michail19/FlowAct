package com.ms.workerservice.execution.service;

import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.InputResolver;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.execution.engine.handler.NodeHandler;
import com.ms.workerservice.execution.engine.handler.NodeHandlerRegistry;
import com.ms.workerservice.execution.entity.ExecutionEntity;
import com.ms.workerservice.execution.entity.ExecutionLogEntity;
import com.ms.workerservice.execution.enumtype.ExecutionLogStatus;
import com.ms.workerservice.execution.enumtype.ExecutionStatus;
import com.ms.workerservice.execution.event.ExecutionCancelRequestedEvent;
import com.ms.workerservice.execution.event.ExecutionRetryRequestedEvent;
import com.ms.workerservice.execution.event.ExecutionRunRequestedEvent;
import com.ms.workerservice.execution.graph.ExecutionGraph;
import com.ms.workerservice.execution.graph.ExecutionGraphBuilder;
import com.ms.workerservice.execution.graph.ExecutionGraphValidator;
import com.ms.workerservice.execution.graph.NextBlockResolver;
import com.ms.workerservice.execution.repository.ExecutionLogRepository;
import com.ms.workerservice.execution.repository.ExecutionRepository;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.entity.WorkflowConnectionEntity;
import com.ms.workerservice.workflow.entity.WorkflowEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import com.ms.workerservice.workflow.repository.WorkflowBlockRepository;
import com.ms.workerservice.workflow.repository.WorkflowConnectionRepository;
import com.ms.workerservice.workflow.repository.WorkflowRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;

@Service
public class ExecutionWorkerService {

    private final ExecutionRepository executionRepository;
    private final ExecutionLogRepository executionLogRepository;
    private final WorkflowRepository workflowRepository;
    private final WorkflowBlockRepository workflowBlockRepository;
    private final WorkflowConnectionRepository workflowConnectionRepository;
    private final ExecutionGraphBuilder executionGraphBuilder;
    private final ExecutionGraphValidator executionGraphValidator;
    private final NextBlockResolver nextBlockResolver;
    private final NodeHandlerRegistry nodeHandlerRegistry;
    private final InputResolver inputResolver;

    public ExecutionWorkerService(
            ExecutionRepository executionRepository,
            ExecutionLogRepository executionLogRepository,
            WorkflowRepository workflowRepository,
            WorkflowBlockRepository workflowBlockRepository,
            WorkflowConnectionRepository workflowConnectionRepository,
            ExecutionGraphBuilder executionGraphBuilder,
            ExecutionGraphValidator executionGraphValidator,
            NextBlockResolver nextBlockResolver,
            NodeHandlerRegistry nodeHandlerRegistry,
            InputResolver inputResolver
    ) {
        this.executionRepository = executionRepository;
        this.executionLogRepository = executionLogRepository;
        this.workflowRepository = workflowRepository;
        this.workflowBlockRepository = workflowBlockRepository;
        this.workflowConnectionRepository = workflowConnectionRepository;
        this.executionGraphBuilder = executionGraphBuilder;
        this.executionGraphValidator = executionGraphValidator;
        this.nextBlockResolver = nextBlockResolver;
        this.nodeHandlerRegistry = nodeHandlerRegistry;
        this.inputResolver = inputResolver;
    }

    @Transactional
    public void handleRunRequested(ExecutionRunRequestedEvent event) {
        ExecutionEntity execution = executionRepository.findById(event.executionId())
                .orElse(null);

        if (execution == null) {
            return;
        }

        if (execution.getStatus() != ExecutionStatus.PENDING) {
            return;
        }

        WorkflowEntity workflow = workflowRepository.findById(event.workflowId())
                .orElse(null);

        if (workflow == null) {
            execution.setStatus(ExecutionStatus.FAILED);
            execution.setErrorMessage("Workflow not found: " + event.workflowId());
            execution.setFinishedAt(OffsetDateTime.now());
            executionRepository.save(execution);
            return;
        }

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
            boolean completed = runWorkflow(execution, workflow, blocks, connections);

            if (!completed) {
                return;
            }

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

    @Transactional
    public void handleRetryRequested(ExecutionRetryRequestedEvent event) {
        handleRunRequested(
                ExecutionRunRequestedEvent.builder()
                        .eventId(event.eventId())
                        .eventType(event.eventType())
                        .executionId(event.executionId())
                        .workflowId(event.workflowId())
                        .notebookId(event.notebookId())
                        .startedByUserId(event.startedByUserId())
                        .triggerType(event.triggerType())
                        .createdAt(event.createdAt())
                        .build()
        );
    }

    @Transactional
    public void handleCancelRequested(ExecutionCancelRequestedEvent event) {
        ExecutionEntity execution = executionRepository.findById(event.executionId())
                .orElse(null);

        if (execution == null) {
            return;
        }

        if (execution.getStatus() == ExecutionStatus.SUCCESS
                || execution.getStatus() == ExecutionStatus.FAILED
                || execution.getStatus() == ExecutionStatus.CANCELLED) {
            return;
        }

        if (execution.getStatus() == ExecutionStatus.PENDING) {
            execution.setStatus(ExecutionStatus.CANCELLED);
            execution.setFinishedAt(OffsetDateTime.now());
            executionRepository.save(execution);
            return;
        }

        if (execution.getStatus() == ExecutionStatus.RUNNING
                || execution.getStatus() == ExecutionStatus.WAITING
                || execution.getStatus() == ExecutionStatus.READY
                || execution.getStatus() == ExecutionStatus.VALIDATING
                || execution.getStatus() == ExecutionStatus.CREATED) {
            execution.setStatus(ExecutionStatus.CANCELLING);
            executionRepository.save(execution);
        }
    }

    private boolean runWorkflow(
            ExecutionEntity execution,
            WorkflowEntity workflow,
            List<WorkflowBlockEntity> blocks,
            List<WorkflowConnectionEntity> connections
    ) {
        ExecutionGraph graph = executionGraphBuilder.build(blocks, connections);
        executionGraphValidator.validate(graph);

        ExecutionContext context = new ExecutionContext(
                execution.getId(),
                workflow.getId()
        );

        WorkflowBlockEntity currentBlock = graph.getStartBlock();

        while (currentBlock != null) {
            ExecutionEntity freshExecution = executionRepository.findById(execution.getId())
                    .orElse(null);

            if (freshExecution == null) {
                return false;
            }

            if (freshExecution.getStatus() == ExecutionStatus.CANCELLING) {
                freshExecution.setStatus(ExecutionStatus.CANCELLED);
                freshExecution.setFinishedAt(OffsetDateTime.now());
                executionRepository.save(freshExecution);
                return false;
            }

            NodeHandler handler = nodeHandlerRegistry.getHandler(currentBlock.getType());

            try {
                ResolvedInput resolvedInput = inputResolver.resolve(graph, currentBlock, context);

                NodeResult result = handler.handle(currentBlock, resolvedInput, context);

                context.putBlockOutput(currentBlock.getId(), result.getOutput());

                createSuccessLog(execution, currentBlock, result.getOutput());

                if (currentBlock.getType() == BlockType.END) {
                    return true;
                }

                currentBlock = nextBlockResolver.resolveNextBlock(graph, currentBlock);

            } catch (Exception ex) {
                createFailureLog(execution, currentBlock, ex.getMessage());
                throw ex;
            }
        }

        return false;
    }

    private void createSuccessLog(
            ExecutionEntity execution,
            WorkflowBlockEntity block,
            Object output
    ) {
        ExecutionLogEntity logEntity = ExecutionLogEntity.builder()
                .id(UUID.randomUUID())
                .execution(execution)
                .block(block)
                .status(ExecutionLogStatus.SUCCESS)
                .output(output != null ? String.valueOf(output) : null)
                .error(null)
                .createdAt(OffsetDateTime.now())
                .build();

        executionLogRepository.save(logEntity);
    }

    private void createFailureLog(
            ExecutionEntity execution,
            WorkflowBlockEntity block,
            String errorMessage
    ) {
        ExecutionLogEntity logEntity = ExecutionLogEntity.builder()
                .id(UUID.randomUUID())
                .execution(execution)
                .block(block)
                .status(ExecutionLogStatus.FAILED)
                .output(null)
                .error(errorMessage)
                .createdAt(OffsetDateTime.now())
                .build();

        executionLogRepository.save(logEntity);
    }
}

package com.ms.workerservice.execution.service;

import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.*;
import com.ms.workerservice.execution.engine.handler.NodeHandler;
import com.ms.workerservice.execution.engine.handler.NodeHandlerRegistry;
import com.ms.workerservice.execution.entity.ExecutionEntity;
import com.ms.workerservice.execution.entity.ExecutionLogEntity;
import com.ms.workerservice.execution.enumtype.ExecutionLogStatus;
import com.ms.workerservice.execution.enumtype.ExecutionStatus;
import com.ms.workerservice.execution.event.ExecutionCancelRequestedEvent;
import com.ms.workerservice.execution.event.ExecutionResumeRequestedEvent;
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
import com.ms.workerservice.workflow.repository.WorkflowBlockRepository;
import com.ms.workerservice.workflow.repository.WorkflowConnectionRepository;
import com.ms.workerservice.workflow.repository.WorkflowRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.backoff.FixedBackOff;

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
    private final ExecutionGraphBuilder executionGraphBuilder;
    private final ExecutionGraphValidator executionGraphValidator;
    private final NextBlockResolver nextBlockResolver;
    private final NodeHandlerRegistry nodeHandlerRegistry;
    private final InputResolver inputResolver;
    private final JsonHelper jsonHelper;

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
            InputResolver inputResolver,
            JsonHelper jsonHelper
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
        this.jsonHelper = jsonHelper;
    }

    public void handleRunRequested(ExecutionRunRequestedEvent event) {
        ExecutionEntity execution = executionRepository
                .findById(event.executionId())
                .orElseThrow(() ->
                        new ExecutionNotReadyException(event.executionId())
                );

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
            NodeResult finalResult = runWorkflow(execution, workflow, blocks, connections);

            if (finalResult == null) {
                return;
            }

            execution.setOutputData(jsonHelper.toJson(finalResult.getOutput()));
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

    public class ExecutionNotReadyException extends RuntimeException {

        public ExecutionNotReadyException(UUID executionId) {
            super("Execution is not visible yet: " + executionId);
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

    @Transactional
    public void handleResumeRequested(ExecutionResumeRequestedEvent event) {
        ExecutionEntity execution = executionRepository.findById(event.executionId())
                .orElse(null);

        if (execution == null) {
            return;
        }

        if (execution.getStatus() != ExecutionStatus.WAITING) {
            return;
        }

        resumeWaitingExecution(execution, event.resumePayload());
    }

    private NodeResult runWorkflow(
            ExecutionEntity execution,
            WorkflowEntity workflow,
            List<WorkflowBlockEntity> blocks,
            List<WorkflowConnectionEntity> connections
    ) {
        ExecutionGraph graph = executionGraphBuilder.build(blocks, connections);
        executionGraphValidator.validate(graph);

        return continueWorkflowFromBlock(
                execution,
                workflow,
                graph,
                graph.getStartBlock(),
                null,
                null
        );
    }

    @Transactional
    public void resumeWaitingExecution(
            ExecutionEntity execution,
            Object resumePayload
    ) {
        if (execution.getStatus() != ExecutionStatus.WAITING) {
            throw new IllegalStateException("Execution is not in WAITING state");
        }

        WaitState waitState = jsonHelper.fromJson(execution.getOutputData(), WaitState.class);
        if (waitState == null || waitState.waitingBlockId() == null || waitState.waitingBlockId().isBlank()) {
            throw new IllegalStateException("Execution has no valid wait state");
        }

        WorkflowEntity workflow = execution.getWorkflow();

        List<WorkflowBlockEntity> blocks = workflowBlockRepository.findByWorkflow_Id(workflow.getId());
        List<WorkflowConnectionEntity> connections = workflowConnectionRepository.findByWorkflow_Id(workflow.getId());

        ExecutionGraph graph = executionGraphBuilder.build(blocks, connections);
        executionGraphValidator.validate(graph);

        WorkflowBlockEntity waitingBlock = graph.getBlock(UUID.fromString(waitState.waitingBlockId()));
        if (waitingBlock == null) {
            throw new IllegalStateException("Waiting block not found: " + waitState.waitingBlockId());
        }

        WorkflowBlockEntity nextBlock = nextBlockResolver.resolveNextBlock(
                graph,
                waitingBlock,
                NodeResult.waitResult(waitState)
        );

        if (nextBlock == null) {
            throw new IllegalStateException("No block to resume after WAIT");
        }

        execution.setStatus(ExecutionStatus.RUNNING);
        execution.setOutputData(null);
        executionRepository.save(execution);

        try {
            NodeResult finalResult = continueWorkflowFromBlock(
                    execution,
                    workflow,
                    graph,
                    nextBlock,
                    waitingBlock.getId(),
                    resumePayload != null ? resumePayload : waitState.input()
            );

            if (finalResult == null) {
                return;
            }

            execution.setOutputData(jsonHelper.toJson(finalResult.getOutput()));
            execution.setStatus(ExecutionStatus.SUCCESS);
            execution.setFinishedAt(OffsetDateTime.now());
            executionRepository.save(execution);

        } catch (Exception ex) {
            execution.setStatus(ExecutionStatus.FAILED);
            execution.setErrorMessage(ex.getMessage());
            execution.setFinishedAt(OffsetDateTime.now());
            executionRepository.save(execution);
        }

        // TODO:
        // Current resume implementation restores only WAIT block output via resumePayload/waitState.input.
        // ExecutionContext state before WAIT (variables, prior block outputs) is not persisted yet.
        // Later this should be replaced with checkpoint/context snapshot persistence.
    }

    private NodeResult continueWorkflowFromBlock(
            ExecutionEntity execution,
            WorkflowEntity workflow,
            ExecutionGraph graph,
            WorkflowBlockEntity startBlock,
            UUID resumedFromWaitBlockId,
            Object resumePayload
    ) {
        ExecutionContext context = new ExecutionContext(
                execution.getId(),
                workflow.getId(),
                resolveExecutionInput(execution)
        );

        if (resumedFromWaitBlockId != null) {
            context.putBlockOutput(resumedFromWaitBlockId, resumePayload);
        }

        WorkflowBlockEntity currentBlock = startBlock;

        while (currentBlock != null) {
            ExecutionEntity freshExecution = executionRepository.findById(execution.getId())
                    .orElse(null);

            if (freshExecution == null) {
                return null;
            }

            if (freshExecution.getStatus() == ExecutionStatus.CANCELLING) {
                freshExecution.setStatus(ExecutionStatus.CANCELLED);
                freshExecution.setFinishedAt(OffsetDateTime.now());
                executionRepository.save(freshExecution);
                return null;
            }

            NodeHandler handler = nodeHandlerRegistry.getHandler(currentBlock.getType());

            ResolvedInput resolvedInput = inputResolver.resolve(graph, currentBlock, context);

            ExecutionLogEntity logEntity = createRunningLog(
                    execution,
                    currentBlock,
                    resolvedInput.getValues()
            );

            try {
                NodeResult result = handler.handle(currentBlock, resolvedInput, context);

                context.putBlockOutput(currentBlock.getId(), result.getOutput());

                markLogSuccess(logEntity, result.getOutput());

                if (result.getAction() == NodeAction.WAIT) {
                    execution.setStatus(ExecutionStatus.WAITING);
                    execution.setOutputData(jsonHelper.toJson(result.getOutput()));
                    executionRepository.save(execution);
                    return null;
                }

                if (result.getAction() == NodeAction.COMPLETE) {
                    return result;
                }

                currentBlock = nextBlockResolver.resolveNextBlock(graph, currentBlock, result);

            } catch (Exception ex) {
                markLogFailed(logEntity, ex.getMessage());
                throw ex;
            }
        }

        if (context.getLastSuccessfulOutput() != null) {
            return NodeResult.of(context.getLastSuccessfulOutput());
        }

        return null;
    }

    private Object resolveExecutionInput(ExecutionEntity execution) {
        return jsonHelper.toObject(execution.getInputData());
    }

    private ExecutionLogEntity createRunningLog(
            ExecutionEntity execution,
            WorkflowBlockEntity block,
            Object input
    ) {
        ExecutionLogEntity logEntity = ExecutionLogEntity.builder()
                .id(UUID.randomUUID())
                .execution(execution)
                .block(block)
                .status(ExecutionLogStatus.RUNNING)
                .input(jsonHelper.toJson(input))
                .output(null)
                .error(null)
                .createdAt(OffsetDateTime.now())
                .build();

        return executionLogRepository.save(logEntity);
    }

    private void markLogSuccess(
            ExecutionLogEntity logEntity,
            Object output
    ) {
        logEntity.setStatus(ExecutionLogStatus.SUCCESS);
        logEntity.setOutput(jsonHelper.toJson(output));
        logEntity.setError(null);

        executionLogRepository.save(logEntity);
    }

    private void markLogFailed(
            ExecutionLogEntity logEntity,
            String errorMessage
    ) {
        logEntity.setStatus(ExecutionLogStatus.FAILED);
        logEntity.setOutput(null);
        logEntity.setError(errorMessage != null ? errorMessage : "Unknown execution error");

        executionLogRepository.save(logEntity);
    }

    @Bean
    public DefaultErrorHandler kafkaErrorHandler() {
        var backOff = new FixedBackOff(
                200L, // задержка между попытками
                5L    // количество повторов
        );

        var handler = new DefaultErrorHandler(backOff);

        handler.addRetryableExceptions(
                ExecutionNotReadyException.class
        );

        return handler;
    }
}

package com.ms.workerservice.execution.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.*;
import com.ms.workerservice.execution.engine.handler.NodeHandler;
import com.ms.workerservice.execution.engine.handler.NodeHandlerRegistry;
import com.ms.workerservice.execution.entity.ExecutionEntity;
import com.ms.workerservice.execution.entity.ExecutionLogEntity;
import com.ms.workerservice.execution.enumtype.ExecutionLogStatus;
import com.ms.workerservice.execution.enumtype.ExecutionStatus;
import com.ms.workerservice.execution.event.ExecutionResumeRequestedEvent;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExecutionWorkerServiceResumeTest {

    @Mock
    private ExecutionRepository executionRepository;
    @Mock
    private ExecutionLogRepository executionLogRepository;
    @Mock
    private WorkflowRepository workflowRepository;
    @Mock
    private WorkflowBlockRepository workflowBlockRepository;
    @Mock
    private WorkflowConnectionRepository workflowConnectionRepository;
    @Mock
    private ExecutionGraphBuilder executionGraphBuilder;
    @Mock
    private ExecutionGraphValidator executionGraphValidator;
    @Mock
    private NextBlockResolver nextBlockResolver;
    @Mock
    private NodeHandlerRegistry nodeHandlerRegistry;
    @Mock
    private InputResolver inputResolver;

    private JsonHelper jsonHelper;

    private ExecutionWorkerService executionWorkerService;

    @BeforeEach
    void setUp() {
        jsonHelper = new JsonHelper(new ObjectMapper());

        executionWorkerService = new ExecutionWorkerService(
                executionRepository,
                executionLogRepository,
                workflowRepository,
                workflowBlockRepository,
                workflowConnectionRepository,
                executionGraphBuilder,
                executionGraphValidator,
                nextBlockResolver,
                nodeHandlerRegistry,
                inputResolver,
                jsonHelper
        );
    }

    @Test
    void handleResumeRequested_shouldIgnoreWhenExecutionNotFound() {
        UUID executionId = UUID.randomUUID();

        ExecutionResumeRequestedEvent event = ExecutionResumeRequestedEvent.builder()
                .eventId(UUID.randomUUID())
                .eventType("EXECUTION_RESUME_REQUESTED")
                .executionId(executionId)
                .workflowId(UUID.randomUUID())
                .notebookId(UUID.randomUUID())
                .resumePayload("payload")
                .createdAt(OffsetDateTime.now())
                .build();

        when(executionRepository.findById(executionId)).thenReturn(Optional.empty());

        assertDoesNotThrow(() -> executionWorkerService.handleResumeRequested(event));

        verify(executionRepository).findById(executionId);
        verifyNoMoreInteractions(executionLogRepository, workflowBlockRepository, workflowConnectionRepository);
    }

    @Test
    void handleResumeRequested_shouldIgnoreWhenExecutionIsNotWaiting() {
        UUID executionId = UUID.randomUUID();

        ExecutionEntity execution = ExecutionEntity.builder()
                .id(executionId)
                .status(ExecutionStatus.RUNNING)
                .build();

        ExecutionResumeRequestedEvent event = ExecutionResumeRequestedEvent.builder()
                .eventId(UUID.randomUUID())
                .eventType("EXECUTION_RESUME_REQUESTED")
                .executionId(executionId)
                .workflowId(UUID.randomUUID())
                .notebookId(UUID.randomUUID())
                .resumePayload("payload")
                .createdAt(OffsetDateTime.now())
                .build();

        when(executionRepository.findById(executionId)).thenReturn(Optional.of(execution));

        assertDoesNotThrow(() -> executionWorkerService.handleResumeRequested(event));

        verify(executionRepository).findById(executionId);
        verify(executionRepository, never()).save(any());
    }

    @Test
    void resumeWaitingExecution_shouldContinueFromBlockAfterWaitAndFinishSuccessfully() {
        UUID executionId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID waitBlockId = UUID.randomUUID();
        UUID endBlockId = UUID.randomUUID();

        WorkflowEntity workflow = WorkflowEntity.builder()
                .id(workflowId)
                .build();

        ExecutionEntity execution = ExecutionEntity.builder()
                .id(executionId)
                .workflow(workflow)
                .status(ExecutionStatus.WAITING)
                .outputData(jsonHelper.toJson(
                        WaitState.builder()
                                .waitType("manual")
                                .resumeKey("resume-1")
                                .waitingBlockId(waitBlockId.toString())
                                .input("saved-input")
                                .build()
                ))
                .build();

        WorkflowBlockEntity waitBlock = WorkflowBlockEntity.builder()
                .id(waitBlockId)
                .type(BlockType.WAIT)
                .name("Wait")
                .position("{}")
                .config("{}")
                .build();

        WorkflowBlockEntity endBlock = WorkflowBlockEntity.builder()
                .id(endBlockId)
                .type(BlockType.END)
                .name("End")
                .position("{}")
                .config("{}")
                .build();

        ExecutionGraph graph = mock(ExecutionGraph.class);

        NodeHandler endHandler = mock(NodeHandler.class);
        ResolvedInput resolvedInput = new ResolvedInput(java.util.Map.of("value", "resume-result"));
        NodeResult endResult = NodeResult.complete("resume-result");

        when(workflowBlockRepository.findByWorkflow_Id(workflowId)).thenReturn(List.of(waitBlock, endBlock));
        when(workflowConnectionRepository.findByWorkflow_Id(workflowId)).thenReturn(List.of());

        when(executionGraphBuilder.build(anyList(), anyList())).thenReturn(graph);
        doNothing().when(executionGraphValidator).validate(graph);

        when(graph.getBlock(UUID.fromString(waitBlockId.toString()))).thenReturn(waitBlock);
        when(nextBlockResolver.resolveNextBlock(eq(graph), eq(waitBlock), any(NodeResult.class)))
                .thenReturn(endBlock);

        when(executionRepository.save(any(ExecutionEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(executionRepository.findById(executionId)).thenReturn(Optional.of(execution));

        when(nodeHandlerRegistry.getHandler(BlockType.END)).thenReturn(endHandler);
        when(inputResolver.resolve(eq(graph), eq(endBlock), any(ExecutionContext.class)))
                .thenReturn(resolvedInput);
        when(endHandler.handle(eq(endBlock), eq(resolvedInput), any(ExecutionContext.class))).thenReturn(endResult);

        when(executionLogRepository.save(any(ExecutionLogEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        executionWorkerService.resumeWaitingExecution(execution, "resume-payload");

        verify(workflowBlockRepository).findByWorkflow_Id(workflowId);
        verify(workflowConnectionRepository).findByWorkflow_Id(workflowId);
        verify(executionGraphBuilder).build(anyList(), anyList());
        verify(executionGraphValidator).validate(graph);

        verify(nextBlockResolver).resolveNextBlock(eq(graph), eq(waitBlock), any(NodeResult.class));
        verify(nodeHandlerRegistry).getHandler(BlockType.END);
        verify(inputResolver).resolve(eq(graph), eq(endBlock), any(ExecutionContext.class));
        verify(endHandler).handle(eq(endBlock), eq(resolvedInput), any(ExecutionContext.class));

        verify(executionRepository, atLeastOnce()).save(execution);
        verify(executionLogRepository, atLeastOnce()).save(any(ExecutionLogEntity.class));
    }
}

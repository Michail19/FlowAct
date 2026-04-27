package com.ms.workerservice.execution.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.*;
import com.ms.workerservice.execution.engine.handler.NodeHandler;
import com.ms.workerservice.execution.engine.handler.NodeHandlerRegistry;
import com.ms.workerservice.execution.entity.ExecutionEntity;
import com.ms.workerservice.execution.entity.ExecutionLogEntity;
import com.ms.workerservice.execution.enumtype.ExecutionStatus;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExecutionWorkerServiceRunTest {

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
    void handleRunRequested_shouldIgnoreWhenExecutionNotFound() {
        UUID executionId = UUID.randomUUID();

        ExecutionRunRequestedEvent event = ExecutionRunRequestedEvent.builder()
                .eventId(UUID.randomUUID())
                .eventType("EXECUTION_RUN_REQUESTED")
                .executionId(executionId)
                .workflowId(UUID.randomUUID())
                .notebookId(UUID.randomUUID())
                .startedByUserId(UUID.randomUUID())
                .triggerType("MANUAL")
                .createdAt(OffsetDateTime.now())
                .build();

        when(executionRepository.findById(executionId)).thenReturn(Optional.empty());

        assertDoesNotThrow(() -> executionWorkerService.handleRunRequested(event));

        verify(executionRepository).findById(executionId);
        verifyNoMoreInteractions(workflowRepository);
    }

    @Test
    void handleRunRequested_shouldFinishSuccessfullyWhenEndCompletes() {
        UUID executionId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();

        WorkflowEntity workflow = WorkflowEntity.builder()
                .id(workflowId)
                .build();

        ExecutionEntity execution = ExecutionEntity.builder()
                .id(executionId)
                .workflow(workflow)
                .status(ExecutionStatus.PENDING)
                .build();

        WorkflowBlockEntity startBlock = WorkflowBlockEntity.builder()
                .id(UUID.randomUUID())
                .type(BlockType.START)
                .name("Start")
                .position("{}")
                .config("{}")
                .build();

        WorkflowBlockEntity endBlock = WorkflowBlockEntity.builder()
                .id(UUID.randomUUID())
                .type(BlockType.END)
                .name("End")
                .position("{}")
                .config("{}")
                .build();

        ExecutionGraph graph = mock(ExecutionGraph.class);

        NodeHandler startHandler = mock(NodeHandler.class);
        NodeHandler endHandler = mock(NodeHandler.class);

        when(executionRepository.findById(executionId))
                .thenReturn(Optional.of(execution));

        when(workflowRepository.findById(workflowId))
                .thenReturn(Optional.of(workflow));

        when(workflowBlockRepository.findByWorkflow_Id(workflowId))
                .thenReturn(List.of(startBlock, endBlock));

        when(workflowConnectionRepository.findByWorkflow_Id(workflowId))
                .thenReturn(List.of());

        when(executionGraphBuilder.build(anyList(), anyList())).thenReturn(graph);
        doNothing().when(executionGraphValidator).validate(graph);

        when(graph.getStartBlock()).thenReturn(startBlock);

        when(nodeHandlerRegistry.getHandler(BlockType.START)).thenReturn(startHandler);
        when(nodeHandlerRegistry.getHandler(BlockType.END)).thenReturn(endHandler);

        when(inputResolver.resolve(eq(graph), eq(startBlock), any(ExecutionContext.class)))
                .thenReturn(ResolvedInput.empty());
        when(inputResolver.resolve(eq(graph), eq(endBlock), any(ExecutionContext.class)))
                .thenReturn(new ResolvedInput(java.util.Map.of("value", "final-result")));

        when(startHandler.handle(eq(startBlock), any(ResolvedInput.class), any(ExecutionContext.class)))
                .thenReturn(NodeResult.empty());

        when(nextBlockResolver.resolveNextBlock(eq(graph), eq(startBlock), any(NodeResult.class)))
                .thenReturn(endBlock);

        when(endHandler.handle(eq(endBlock), any(ResolvedInput.class), any(ExecutionContext.class)))
                .thenReturn(NodeResult.complete("final-result"));

        when(executionRepository.save(any(ExecutionEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        when(executionLogRepository.save(any(ExecutionLogEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        assertDoesNotThrow(() -> executionWorkerService.handleRunRequested(
                ExecutionRunRequestedEvent.builder()
                        .eventId(UUID.randomUUID())
                        .eventType("EXECUTION_RUN_REQUESTED")
                        .executionId(executionId)
                        .workflowId(workflowId)
                        .notebookId(UUID.randomUUID())
                        .startedByUserId(UUID.randomUUID())
                        .triggerType("MANUAL")
                        .createdAt(OffsetDateTime.now())
                        .build()
        ));

        verify(workflowRepository).findById(workflowId);
        verify(executionRepository, atLeastOnce()).save(execution);
        verify(executionLogRepository, atLeastOnce()).save(any(ExecutionLogEntity.class));
        verify(endHandler).handle(eq(endBlock), any(ResolvedInput.class), any(ExecutionContext.class));
    }
}

package com.ms.workerservice.execution.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.InputResolver;
import com.ms.workerservice.execution.engine.handler.NodeHandlerRegistry;
import com.ms.workerservice.execution.entity.ExecutionEntity;
import com.ms.workerservice.execution.enumtype.ExecutionStatus;
import com.ms.workerservice.execution.event.ExecutionCancelRequestedEvent;
import com.ms.workerservice.execution.graph.ExecutionGraphBuilder;
import com.ms.workerservice.execution.graph.ExecutionGraphValidator;
import com.ms.workerservice.execution.graph.NextBlockResolver;
import com.ms.workerservice.execution.repository.ExecutionLogRepository;
import com.ms.workerservice.execution.repository.ExecutionRepository;
import com.ms.workerservice.workflow.entity.WorkflowEntity;
import com.ms.workerservice.workflow.repository.WorkflowBlockRepository;
import com.ms.workerservice.workflow.repository.WorkflowConnectionRepository;
import com.ms.workerservice.workflow.repository.WorkflowRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExecutionWorkerServiceCancelTest {

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
    void handleCancelRequested_shouldIgnoreWhenExecutionNotFound() {
        UUID executionId = UUID.randomUUID();

        when(executionRepository.findById(executionId)).thenReturn(Optional.empty());

        assertDoesNotThrow(() -> executionWorkerService.handleCancelRequested(
                ExecutionCancelRequestedEvent.builder()
                        .eventId(UUID.randomUUID())
                        .eventType("EXECUTION_CANCEL_REQUESTED")
                        .executionId(executionId)
                        .workflowId(UUID.randomUUID())
                        .notebookId(UUID.randomUUID())
                        .createdAt(OffsetDateTime.now())
                        .build()
        ));

        verify(executionRepository).findById(executionId);
        verify(executionRepository, never()).save(any());
    }

    @Test
    void handleCancelRequested_shouldSetCancelledWhenPending() {
        UUID executionId = UUID.randomUUID();

        ExecutionEntity execution = ExecutionEntity.builder()
                .id(executionId)
                .workflow(WorkflowEntity.builder().id(UUID.randomUUID()).build())
                .status(ExecutionStatus.PENDING)
                .build();

        when(executionRepository.findById(executionId)).thenReturn(Optional.of(execution));
        when(executionRepository.save(any(ExecutionEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        executionWorkerService.handleCancelRequested(
                ExecutionCancelRequestedEvent.builder()
                        .eventId(UUID.randomUUID())
                        .eventType("EXECUTION_CANCEL_REQUESTED")
                        .executionId(executionId)
                        .workflowId(UUID.randomUUID())
                        .notebookId(UUID.randomUUID())
                        .createdAt(OffsetDateTime.now())
                        .build()
        );

        verify(executionRepository).save(execution);
        assert execution.getStatus() == ExecutionStatus.CANCELLED;
    }

    @Test
    void handleCancelRequested_shouldSetCancellingWhenRunning() {
        UUID executionId = UUID.randomUUID();

        ExecutionEntity execution = ExecutionEntity.builder()
                .id(executionId)
                .workflow(WorkflowEntity.builder().id(UUID.randomUUID()).build())
                .status(ExecutionStatus.RUNNING)
                .build();

        when(executionRepository.findById(executionId)).thenReturn(Optional.of(execution));
        when(executionRepository.save(any(ExecutionEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        executionWorkerService.handleCancelRequested(
                ExecutionCancelRequestedEvent.builder()
                        .eventId(UUID.randomUUID())
                        .eventType("EXECUTION_CANCEL_REQUESTED")
                        .executionId(executionId)
                        .workflowId(UUID.randomUUID())
                        .notebookId(UUID.randomUUID())
                        .createdAt(OffsetDateTime.now())
                        .build()
        );

        verify(executionRepository).save(execution);
        assert execution.getStatus() == ExecutionStatus.CANCELLING;
    }

    @Test
    void handleCancelRequested_shouldIgnoreWhenAlreadyFinished() {
        UUID executionId = UUID.randomUUID();

        ExecutionEntity execution = ExecutionEntity.builder()
                .id(executionId)
                .workflow(WorkflowEntity.builder().id(UUID.randomUUID()).build())
                .status(ExecutionStatus.SUCCESS)
                .build();

        when(executionRepository.findById(executionId)).thenReturn(Optional.of(execution));

        executionWorkerService.handleCancelRequested(
                ExecutionCancelRequestedEvent.builder()
                        .eventId(UUID.randomUUID())
                        .eventType("EXECUTION_CANCEL_REQUESTED")
                        .executionId(executionId)
                        .workflowId(UUID.randomUUID())
                        .notebookId(UUID.randomUUID())
                        .createdAt(OffsetDateTime.now())
                        .build()
        );

        verify(executionRepository, never()).save(any());
    }
}

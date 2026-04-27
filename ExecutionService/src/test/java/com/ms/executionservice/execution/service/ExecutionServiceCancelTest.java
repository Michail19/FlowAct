package com.ms.executionservice.execution.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ms.executionservice.common.exception.EntityNotFoundException;
import com.ms.executionservice.common.util.JsonUtils;
import com.ms.executionservice.execution.dto.response.ExecutionResponse;
import com.ms.executionservice.execution.entity.ExecutionEntity;
import com.ms.executionservice.execution.enumtype.ExecutionStatus;
import com.ms.executionservice.execution.repository.ExecutionLogRepository;
import com.ms.executionservice.execution.repository.ExecutionRepository;
import com.ms.executionservice.workflow.entity.WorkflowEntity;
import com.ms.executionservice.workflow.repository.WorkflowRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExecutionServiceCancelTest {

    @Mock
    private WorkflowRepository workflowRepository;

    @Mock
    private ExecutionRepository executionRepository;

    @Mock
    private ExecutionLogRepository executionLogRepository;

    @Mock
    private ExecutionDispatchService executionDispatchService;

    private JsonUtils jsonUtils;
    private ExecutionService executionService;

    @BeforeEach
    void setUp() {
        jsonUtils = new JsonUtils(new ObjectMapper());
        executionService = new ExecutionService(
                workflowRepository,
                executionRepository,
                executionLogRepository,
                jsonUtils,
                executionDispatchService
        );
    }

    @Test
    void cancel_shouldThrowWhenExecutionNotFound() {
        UUID notebookId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID executionId = UUID.randomUUID();

        when(executionRepository.findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(
                executionId, workflowId, notebookId
        )).thenReturn(Optional.empty());

        assertThrows(
                EntityNotFoundException.class,
                () -> executionService.cancel(notebookId, workflowId, executionId)
        );

        verifyNoInteractions(executionDispatchService);
    }

    @Test
    void cancel_shouldThrowWhenExecutionAlreadyFinished() {
        UUID notebookId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID executionId = UUID.randomUUID();

        WorkflowEntity workflow = WorkflowEntity.builder()
                .id(workflowId)
                .build();

        ExecutionEntity execution = ExecutionEntity.builder()
                .id(executionId)
                .workflow(workflow)
                .startedByUserId(UUID.randomUUID())
                .status(ExecutionStatus.SUCCESS)
                .build();

        when(executionRepository.findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(
                executionId, workflowId, notebookId
        )).thenReturn(Optional.of(execution));

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> executionService.cancel(notebookId, workflowId, executionId)
        );

        assertTrue(ex.getMessage().contains("already finished"));
        verifyNoInteractions(executionDispatchService);
    }

    @Test
    void cancel_shouldCancelImmediatelyWhenPending() {
        UUID notebookId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID executionId = UUID.randomUUID();

        WorkflowEntity workflow = WorkflowEntity.builder()
                .id(workflowId)
                .build();

        ExecutionEntity execution = ExecutionEntity.builder()
                .id(executionId)
                .workflow(workflow)
                .startedByUserId(UUID.randomUUID())
                .status(ExecutionStatus.PENDING)
                .build();

        when(executionRepository.findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(
                executionId, workflowId, notebookId
        )).thenReturn(Optional.of(execution));

        when(executionRepository.save(any(ExecutionEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ExecutionResponse response = executionService.cancel(
                notebookId,
                workflowId,
                executionId
        );

        assertNotNull(response);
        assertEquals(ExecutionStatus.CANCELLED, response.status());
        assertNotNull(response.finishedAt());

        ArgumentCaptor<ExecutionEntity> entityCaptor = ArgumentCaptor.forClass(ExecutionEntity.class);
        verify(executionRepository).save(entityCaptor.capture());

        ExecutionEntity saved = entityCaptor.getValue();
        assertEquals(ExecutionStatus.CANCELLED, saved.getStatus());
        assertNotNull(saved.getFinishedAt());

        verifyNoInteractions(executionDispatchService);
    }

    @Test
    void cancel_shouldSetCancellingAndPublishEventWhenRunning() {
        UUID notebookId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID executionId = UUID.randomUUID();

        WorkflowEntity workflow = WorkflowEntity.builder()
                .id(workflowId)
                .build();

        ExecutionEntity execution = ExecutionEntity.builder()
                .id(executionId)
                .workflow(workflow)
                .startedByUserId(UUID.randomUUID())
                .status(ExecutionStatus.RUNNING)
                .startedAt(OffsetDateTime.now().minusMinutes(1))
                .build();

        when(executionRepository.findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(
                executionId, workflowId, notebookId
        )).thenReturn(Optional.of(execution));

        when(executionRepository.save(any(ExecutionEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ExecutionResponse response = executionService.cancel(
                notebookId,
                workflowId,
                executionId
        );

        assertNotNull(response);
        assertEquals(ExecutionStatus.CANCELLING, response.status());

        ArgumentCaptor<ExecutionEntity> entityCaptor = ArgumentCaptor.forClass(ExecutionEntity.class);
        verify(executionRepository).save(entityCaptor.capture());

        ExecutionEntity saved = entityCaptor.getValue();
        assertEquals(ExecutionStatus.CANCELLING, saved.getStatus());

        verify(executionDispatchService).publishCancelRequested(
                executionId,
                workflowId,
                notebookId
        );
    }

    @Test
    void cancel_shouldReturnAsIsWhenAlreadyCancelling() {
        UUID notebookId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID executionId = UUID.randomUUID();

        WorkflowEntity workflow = WorkflowEntity.builder()
                .id(workflowId)
                .build();

        ExecutionEntity execution = ExecutionEntity.builder()
                .id(executionId)
                .workflow(workflow)
                .startedByUserId(UUID.randomUUID())
                .status(ExecutionStatus.CANCELLING)
                .build();

        when(executionRepository.findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(
                executionId, workflowId, notebookId
        )).thenReturn(Optional.of(execution));

        ExecutionResponse response = executionService.cancel(
                notebookId,
                workflowId,
                executionId
        );

        assertNotNull(response);
        assertEquals(ExecutionStatus.CANCELLING, response.status());

        verify(executionRepository, never()).save(any());
        verifyNoInteractions(executionDispatchService);
    }
}

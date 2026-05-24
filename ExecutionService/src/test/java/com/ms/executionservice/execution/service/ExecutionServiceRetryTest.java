package com.ms.executionservice.execution.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ms.executionservice.common.exception.EntityNotFoundException;
import com.ms.executionservice.common.util.JsonUtils;
import com.ms.executionservice.execution.dto.response.ExecutionResponse;
import com.ms.executionservice.execution.entity.ExecutionEntity;
import com.ms.executionservice.execution.enumtype.ExecutionStatus;
import com.ms.executionservice.execution.event.ExecutionRetryDispatchEvent;
import com.ms.executionservice.execution.repository.ExecutionLogRepository;
import com.ms.executionservice.execution.repository.ExecutionRepository;
import com.ms.executionservice.notebooks.repository.NotebookRepository;
import com.ms.executionservice.workflow.entity.WorkflowEntity;
import com.ms.executionservice.workflow.repository.WorkflowRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExecutionServiceRetryTest {

    @Mock
    private NotebookRepository notebookRepository;

    @Mock
    private WorkflowRepository workflowRepository;

    @Mock
    private ExecutionRepository executionRepository;

    @Mock
    private ExecutionLogRepository executionLogRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    private JsonUtils jsonUtils;
    private ExecutionService executionService;

    @BeforeEach
    void setUp() {
        jsonUtils = new JsonUtils(new ObjectMapper());
        executionService = new ExecutionService(
                notebookRepository,
                workflowRepository,
                executionRepository,
                executionLogRepository,
                jsonUtils,
                eventPublisher
        );
    }

    @Test
    void retry_shouldThrowWhenExecutionNotFound() {
        UUID currentUserId = UUID.randomUUID();
        UUID notebookId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID executionId = UUID.randomUUID();

        when(notebookRepository.existsByIdAndOwnerUserId(notebookId, currentUserId))
                .thenReturn(true);
        when(workflowRepository.findByIdAndNotebook_Id(workflowId, notebookId))
                .thenReturn(Optional.of(WorkflowEntity.builder().id(workflowId).build()));
        when(executionRepository.findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(
                executionId, workflowId, notebookId
        )).thenReturn(Optional.empty());

        assertThrows(
                EntityNotFoundException.class,
                () -> executionService.retry(currentUserId, notebookId, workflowId, executionId)
        );

        verifyNoInteractions(eventPublisher);
    }

    @Test
    void retry_shouldThrowWhenExecutionStatusIsNotRetryable() {
        UUID currentUserId = UUID.randomUUID();
        UUID notebookId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID executionId = UUID.randomUUID();

        WorkflowEntity workflow = WorkflowEntity.builder()
                .id(workflowId)
                .build();

        ExecutionEntity oldExecution = ExecutionEntity.builder()
                .id(executionId)
                .workflow(workflow)
                .startedByUserId(UUID.randomUUID())
                .status(ExecutionStatus.RUNNING)
                .inputData("{\"text\":\"hello\"}")
                .outputData(null)
                .errorMessage(null)
                .build();

        when(notebookRepository.existsByIdAndOwnerUserId(notebookId, currentUserId))
                .thenReturn(true);
        when(workflowRepository.findByIdAndNotebook_Id(workflowId, notebookId))
                .thenReturn(Optional.of(workflow));
        when(executionRepository.findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(
                executionId, workflowId, notebookId
        )).thenReturn(Optional.of(oldExecution));

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> executionService.retry(currentUserId, notebookId, workflowId, executionId)
        );

        assertTrue(ex.getMessage().contains("only after SUCCESS, FAILED or CANCELLED"));

        verify(executionRepository, never()).save(any());
        verifyNoInteractions(eventPublisher);
    }

    @Test
    void retry_shouldCreateNewPendingExecutionWhenOldExecutionIsSuccess() {
        UUID currentUserId = UUID.randomUUID();
        UUID notebookId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID oldExecutionId = UUID.randomUUID();
        UUID startedByUserId = UUID.randomUUID();

        WorkflowEntity workflow = WorkflowEntity.builder()
                .id(workflowId)
                .build();

        ExecutionEntity oldExecution = ExecutionEntity.builder()
                .id(oldExecutionId)
                .workflow(workflow)
                .startedByUserId(startedByUserId)
                .status(ExecutionStatus.SUCCESS)
                .inputData("{\"text\":\"hello\"}")
                .outputData("{\"result\":\"ok\"}")
                .errorMessage(null)
                .build();

        when(notebookRepository.existsByIdAndOwnerUserId(notebookId, currentUserId))
                .thenReturn(true);
        when(workflowRepository.findByIdAndNotebook_Id(workflowId, notebookId))
                .thenReturn(Optional.of(workflow));
        when(executionRepository.findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(
                oldExecutionId, workflowId, notebookId
        )).thenReturn(Optional.of(oldExecution));

        when(executionRepository.save(any(ExecutionEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ExecutionResponse response = executionService.retry(
                currentUserId,
                notebookId,
                workflowId,
                oldExecutionId
        );

        assertNotNull(response);
        assertNotNull(response.id());
        assertNotEquals(oldExecutionId, response.id());
        assertEquals(workflowId, response.workflowId());
        assertEquals(currentUserId, response.startedByUserId());
        assertEquals(ExecutionStatus.PENDING, response.status());
        assertEquals("{\"text\":\"hello\"}", jsonUtils.toJson(response.inputData()));
        assertTrue(response.outputData().isEmpty());
        assertNull(response.errorMessage());

        ArgumentCaptor<ExecutionRetryDispatchEvent> eventCaptor =
                ArgumentCaptor.forClass(ExecutionRetryDispatchEvent.class);

        verify(eventPublisher).publishEvent(eventCaptor.capture());

        ExecutionRetryDispatchEvent event = eventCaptor.getValue();

        assertEquals(oldExecutionId, event.sourceExecutionId());
        assertEquals(response.id(), event.executionId());
        assertEquals(workflowId, event.workflowId());
        assertEquals(notebookId, event.notebookId());
        assertEquals(currentUserId, event.startedByUserId());
    }

    @Test
    void retry_shouldCreateNewPendingExecutionPublishRetryEventAndReturnResponse() {
        UUID currentUserId = UUID.randomUUID();
        UUID notebookId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID oldExecutionId = UUID.randomUUID();
        UUID startedByUserId = UUID.randomUUID();

        WorkflowEntity workflow = WorkflowEntity.builder()
                .id(workflowId)
                .build();

        ExecutionEntity oldExecution = ExecutionEntity.builder()
                .id(oldExecutionId)
                .workflow(workflow)
                .startedByUserId(startedByUserId)
                .status(ExecutionStatus.FAILED)
                .inputData("{\"text\":\"hello\"}")
                .outputData("{\"result\":\"old\"}")
                .errorMessage("boom")
                .build();

        when(notebookRepository.existsByIdAndOwnerUserId(notebookId, currentUserId))
                .thenReturn(true);
        when(workflowRepository.findByIdAndNotebook_Id(workflowId, notebookId))
                .thenReturn(Optional.of(workflow));
        when(executionRepository.findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(
                oldExecutionId, workflowId, notebookId
        )).thenReturn(Optional.of(oldExecution));

        when(executionRepository.save(any(ExecutionEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ExecutionResponse response = executionService.retry(
                currentUserId,
                notebookId,
                workflowId,
                oldExecutionId
        );

        assertNotNull(response);
        assertNotNull(response.id());
        assertNotEquals(oldExecutionId, response.id());
        assertEquals(workflowId, response.workflowId());
        assertEquals(currentUserId, response.startedByUserId());
        assertEquals(ExecutionStatus.PENDING, response.status());
        assertEquals("{\"text\":\"hello\"}", jsonUtils.toJson(response.inputData()));
        assertTrue(response.outputData().isEmpty());
        assertNull(response.errorMessage());

        ArgumentCaptor<ExecutionEntity> entityCaptor = ArgumentCaptor.forClass(ExecutionEntity.class);
        verify(executionRepository).save(entityCaptor.capture());

        ExecutionEntity newExecution = entityCaptor.getValue();
        assertEquals(workflowId, newExecution.getWorkflow().getId());
        assertEquals(currentUserId, newExecution.getStartedByUserId());
        assertEquals(ExecutionStatus.PENDING, newExecution.getStatus());
        assertEquals("{\"text\":\"hello\"}", newExecution.getInputData());
        assertNull(newExecution.getOutputData());
        assertNull(newExecution.getErrorMessage());

        ArgumentCaptor<ExecutionRetryDispatchEvent> eventCaptor =
                ArgumentCaptor.forClass(ExecutionRetryDispatchEvent.class);

        verify(eventPublisher).publishEvent(eventCaptor.capture());

        ExecutionRetryDispatchEvent event = eventCaptor.getValue();

        assertEquals(oldExecutionId, event.sourceExecutionId());
        assertEquals(response.id(), event.executionId());
        assertEquals(workflowId, event.workflowId());
        assertEquals(notebookId, event.notebookId());
        assertEquals(currentUserId, event.startedByUserId());
    }
}

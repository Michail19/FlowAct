package com.ms.executionservice.execution.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ms.executionservice.common.exception.EntityNotFoundException;
import com.ms.executionservice.common.util.JsonUtils;
import com.ms.executionservice.execution.dto.request.CreateExecutionRequest;
import com.ms.executionservice.execution.dto.response.ExecutionResponse;
import com.ms.executionservice.execution.entity.ExecutionEntity;
import com.ms.executionservice.execution.enumtype.ExecutionStatus;
import com.ms.executionservice.execution.event.ExecutionRunDispatchEvent;
import com.ms.executionservice.execution.repository.ExecutionLogRepository;
import com.ms.executionservice.execution.repository.ExecutionRepository;
import com.ms.executionservice.notebooks.repository.NotebookRepository;
import com.ms.executionservice.workflow.entity.WorkflowEntity;
import com.ms.executionservice.workflow.enumtype.WorkflowStatus;
import com.ms.executionservice.workflow.repository.WorkflowRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExecutionServiceRunTest {

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
    void run_shouldThrowWhenWorkflowNotFound() {
        UUID notebookId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID currentUserId = UUID.randomUUID();

        CreateExecutionRequest request = CreateExecutionRequest.builder()
                .inputData(Map.of("text", "hello"))
                .build();

        when(notebookRepository.existsByIdAndOwnerUserId(notebookId, currentUserId))
                .thenReturn(true);
        when(workflowRepository.findByIdAndNotebook_Id(workflowId, notebookId))
                .thenReturn(Optional.empty());

        assertThrows(
                EntityNotFoundException.class,
                () -> executionService.run(currentUserId, notebookId, workflowId, request)
        );

        verify(notebookRepository).existsByIdAndOwnerUserId(notebookId, currentUserId);
        verify(workflowRepository).findByIdAndNotebook_Id(workflowId, notebookId);
        verifyNoInteractions(executionRepository, eventPublisher);
    }

    @Test
    void run_shouldThrowWhenNotebookDoesNotBelongToCurrentUser() {
        UUID notebookId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID currentUserId = UUID.randomUUID();

        CreateExecutionRequest request = CreateExecutionRequest.builder()
                .inputData(Map.of("text", "hello"))
                .build();

        when(notebookRepository.existsByIdAndOwnerUserId(notebookId, currentUserId))
                .thenReturn(false);

        assertThrows(
                EntityNotFoundException.class,
                () -> executionService.run(currentUserId, notebookId, workflowId, request)
        );

        verify(notebookRepository).existsByIdAndOwnerUserId(notebookId, currentUserId);
        verifyNoInteractions(workflowRepository, executionRepository, eventPublisher);
    }

    @Test
    void run_shouldThrowWhenWorkflowIsNotActive() {
        UUID notebookId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID currentUserId = UUID.randomUUID();

        WorkflowEntity workflow = WorkflowEntity.builder()
                .id(workflowId)
                .status(WorkflowStatus.DRAFT)
                .build();

        CreateExecutionRequest request = CreateExecutionRequest.builder()
                .inputData(Map.of("text", "hello"))
                .build();

        when(notebookRepository.existsByIdAndOwnerUserId(notebookId, currentUserId))
                .thenReturn(true);
        when(workflowRepository.findByIdAndNotebook_Id(workflowId, notebookId))
                .thenReturn(Optional.of(workflow));

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> executionService.run(currentUserId, notebookId, workflowId, request)
        );

        assertTrue(ex.getMessage().contains("DRAFT"));
        assertTrue(ex.getMessage().contains("активируйте"));

        verify(notebookRepository).existsByIdAndOwnerUserId(notebookId, currentUserId);
        verify(workflowRepository).findByIdAndNotebook_Id(workflowId, notebookId);
        verifyNoInteractions(executionRepository, eventPublisher);
    }

    @Test
    void run_shouldCreatePendingExecutionPublishEventAndReturnResponse() {
        UUID notebookId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID currentUserId = UUID.randomUUID();

        WorkflowEntity workflow = WorkflowEntity.builder()
                .id(workflowId)
                .status(WorkflowStatus.ACTIVE)
                .build();

        CreateExecutionRequest request = CreateExecutionRequest.builder()
                .inputData(Map.of("text", "hello"))
                .build();

        when(notebookRepository.existsByIdAndOwnerUserId(notebookId, currentUserId))
                .thenReturn(true);
        when(workflowRepository.findByIdAndNotebook_Id(workflowId, notebookId))
                .thenReturn(Optional.of(workflow));

        when(executionRepository.save(any(ExecutionEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ExecutionResponse response = executionService.run(
                currentUserId,
                notebookId,
                workflowId,
                request
        );

        assertNotNull(response);
        assertNotNull(response.id());
        assertEquals(workflowId, response.workflowId());
        assertEquals(currentUserId, response.startedByUserId());
        assertEquals(ExecutionStatus.PENDING, response.status());
        assertEquals(Map.of("text", "hello"), response.inputData());
        assertTrue(response.outputData().isEmpty());
        assertNull(response.errorMessage());
        assertNull(response.startedAt());
        assertNull(response.finishedAt());

        ArgumentCaptor<ExecutionEntity> entityCaptor = ArgumentCaptor.forClass(ExecutionEntity.class);
        verify(executionRepository).save(entityCaptor.capture());

        ExecutionEntity savedEntity = entityCaptor.getValue();
        assertEquals(workflowId, savedEntity.getWorkflow().getId());
        assertEquals(currentUserId, savedEntity.getStartedByUserId());
        assertEquals(ExecutionStatus.PENDING, savedEntity.getStatus());
        assertEquals("{\"text\":\"hello\"}", savedEntity.getInputData());
        assertNull(savedEntity.getOutputData());

        ArgumentCaptor<ExecutionRunDispatchEvent> eventCaptor =
                ArgumentCaptor.forClass(ExecutionRunDispatchEvent.class);

        verify(eventPublisher).publishEvent(eventCaptor.capture());

        ExecutionRunDispatchEvent event = eventCaptor.getValue();

        assertEquals(response.id(), event.executionId());
        assertEquals(workflowId, event.workflowId());
        assertEquals(notebookId, event.notebookId());
        assertEquals(currentUserId, event.startedByUserId());
    }
}

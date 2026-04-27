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

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExecutionServiceRetryTest {

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
    void retry_shouldThrowWhenExecutionNotFound() {
        UUID notebookId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID executionId = UUID.randomUUID();

        when(executionRepository.findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(
                executionId, workflowId, notebookId
        )).thenReturn(Optional.empty());

        assertThrows(
                EntityNotFoundException.class,
                () -> executionService.retry(notebookId, workflowId, executionId)
        );

        verifyNoInteractions(executionDispatchService);
    }

    @Test
    void retry_shouldThrowWhenExecutionStatusIsNotRetryable() {
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
                .status(ExecutionStatus.SUCCESS)
                .inputData("{\"text\":\"hello\"}")
                .outputData("{\"result\":\"ok\"}")
                .errorMessage(null)
                .build();

        when(executionRepository.findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(
                executionId, workflowId, notebookId
        )).thenReturn(Optional.of(oldExecution));

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> executionService.retry(notebookId, workflowId, executionId)
        );

        assertTrue(ex.getMessage().contains("cannot be retried"));
        verifyNoInteractions(executionDispatchService);
    }

    @Test
    void retry_shouldCreateNewPendingExecutionPublishRetryEventAndReturnResponse() {
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

        when(executionRepository.findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(
                oldExecutionId, workflowId, notebookId
        )).thenReturn(Optional.of(oldExecution));

        when(executionRepository.save(any(ExecutionEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ExecutionResponse response = executionService.retry(
                notebookId,
                workflowId,
                oldExecutionId
        );

        assertNotNull(response);
        assertNotNull(response.id());
        assertNotEquals(oldExecutionId, response.id());
        assertEquals(workflowId, response.workflowId());
        assertEquals(startedByUserId, response.startedByUserId());
        assertEquals(ExecutionStatus.PENDING, response.status());
        assertEquals("{\"text\":\"hello\"}", jsonUtils.toJson(response.inputData()));
        assertTrue(response.outputData().isEmpty());
        assertNull(response.errorMessage());

        ArgumentCaptor<ExecutionEntity> entityCaptor = ArgumentCaptor.forClass(ExecutionEntity.class);
        verify(executionRepository).save(entityCaptor.capture());

        ExecutionEntity newExecution = entityCaptor.getValue();
        assertEquals(workflowId, newExecution.getWorkflow().getId());
        assertEquals(startedByUserId, newExecution.getStartedByUserId());
        assertEquals(ExecutionStatus.PENDING, newExecution.getStatus());
        assertEquals("{\"text\":\"hello\"}", newExecution.getInputData());
        assertNull(newExecution.getOutputData());
        assertNull(newExecution.getErrorMessage());

        verify(executionDispatchService).publishRetryRequested(
                oldExecutionId,
                response.id(),
                workflowId,
                notebookId,
                startedByUserId
        );
    }
}

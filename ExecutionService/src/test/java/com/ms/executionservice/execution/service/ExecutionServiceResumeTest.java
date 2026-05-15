package com.ms.executionservice.execution.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ms.executionservice.common.exception.EntityNotFoundException;
import com.ms.executionservice.common.util.JsonUtils;
import com.ms.executionservice.execution.dto.response.ExecutionResponse;
import com.ms.executionservice.execution.entity.ExecutionEntity;
import com.ms.executionservice.execution.enumtype.ExecutionStatus;
import com.ms.executionservice.execution.repository.ExecutionLogRepository;
import com.ms.executionservice.execution.repository.ExecutionRepository;
import com.ms.executionservice.notebooks.repository.NotebookRepository;
import com.ms.executionservice.workflow.entity.WorkflowEntity;
import com.ms.executionservice.workflow.repository.WorkflowRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExecutionServiceResumeTest {

    @Mock
    private NotebookRepository notebookRepository;

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
                notebookRepository,
                workflowRepository,
                executionRepository,
                executionLogRepository,
                jsonUtils,
                executionDispatchService
        );
    }

    @Test
    void resume_shouldThrowWhenExecutionNotFound() {
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
                () -> executionService.resume(
                        currentUserId,
                        notebookId,
                        workflowId,
                        executionId,
                        Map.of("approved", true)
                )
        );

        verify(executionRepository).findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(
                executionId, workflowId, notebookId
        );
        verifyNoInteractions(executionDispatchService);
    }

    @Test
    void resume_shouldThrowWhenExecutionIsNotWaiting() {
        UUID currentUserId = UUID.randomUUID();
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
                .inputData("{\"text\":\"hello\"}")
                .outputData(null)
                .errorMessage(null)
                .startedAt(null)
                .finishedAt(null)
                .build();

        when(notebookRepository.existsByIdAndOwnerUserId(notebookId, currentUserId))
                .thenReturn(true);
        when(workflowRepository.findByIdAndNotebook_Id(workflowId, notebookId))
                .thenReturn(Optional.of(workflow));
        when(executionRepository.findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(
                executionId, workflowId, notebookId
        )).thenReturn(Optional.of(execution));

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> executionService.resume(
                        currentUserId,
                        notebookId,
                        workflowId,
                        executionId,
                        Map.of("approved", true)
                )
        );

        assertTrue(ex.getMessage().contains("WAITING"));

        verify(executionRepository).findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(
                executionId, workflowId, notebookId
        );
        verifyNoInteractions(executionDispatchService);
    }

    @Test
    void resume_shouldPublishResumeRequestedAndReturnResponse() {
        UUID currentUserId = UUID.randomUUID();
        UUID notebookId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID executionId = UUID.randomUUID();
        UUID startedByUserId = UUID.randomUUID();

        WorkflowEntity workflow = WorkflowEntity.builder()
                .id(workflowId)
                .build();

        OffsetDateTime startedAt = OffsetDateTime.now().minusMinutes(1);

        ExecutionEntity execution = ExecutionEntity.builder()
                .id(executionId)
                .workflow(workflow)
                .startedByUserId(startedByUserId)
                .status(ExecutionStatus.WAITING)
                .inputData("{\"text\":\"hello\"}")
                .outputData("{\"waitType\":\"manual\"}")
                .errorMessage(null)
                .startedAt(startedAt)
                .finishedAt(null)
                .build();

        when(notebookRepository.existsByIdAndOwnerUserId(notebookId, currentUserId))
                .thenReturn(true);
        when(workflowRepository.findByIdAndNotebook_Id(workflowId, notebookId))
                .thenReturn(Optional.of(workflow));
        when(executionRepository.findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(
                executionId, workflowId, notebookId
        )).thenReturn(Optional.of(execution));

        Object resumePayload = Map.of("approved", true);

        ExecutionResponse response = executionService.resume(
                currentUserId,
                notebookId,
                workflowId,
                executionId,
                resumePayload
        );

        assertNotNull(response);
        assertEquals(executionId, response.id());
        assertEquals(workflowId, response.workflowId());
        assertEquals(startedByUserId, response.startedByUserId());
        assertEquals(ExecutionStatus.WAITING, response.status());
        assertEquals(Map.of("text", "hello"), response.inputData());
        assertEquals(Map.of("waitType", "manual"), response.outputData());
        assertEquals(startedAt, response.startedAt());
        assertNull(response.finishedAt());

        verify(executionRepository).findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(
                executionId, workflowId, notebookId
        );

        verify(executionDispatchService).publishResumeRequested(
                executionId,
                workflowId,
                notebookId,
                resumePayload
        );

        verifyNoMoreInteractions(executionDispatchService);
    }

    @Test
    void resume_shouldAllowNullResumePayload() {
        UUID currentUserId = UUID.randomUUID();
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
                .status(ExecutionStatus.WAITING)
                .inputData("{}")
                .outputData("{\"waitType\":\"manual\"}")
                .errorMessage(null)
                .startedAt(null)
                .finishedAt(null)
                .build();

        when(notebookRepository.existsByIdAndOwnerUserId(notebookId, currentUserId))
                .thenReturn(true);
        when(workflowRepository.findByIdAndNotebook_Id(workflowId, notebookId))
                .thenReturn(Optional.of(workflow));
        when(executionRepository.findByIdAndWorkflow_IdAndWorkflow_Notebook_Id(
                executionId, workflowId, notebookId
        )).thenReturn(Optional.of(execution));

        ExecutionResponse response = executionService.resume(
                currentUserId,
                notebookId,
                workflowId,
                executionId,
                null
        );

        assertNotNull(response);
        assertEquals(ExecutionStatus.WAITING, response.status());

        verify(executionDispatchService).publishResumeRequested(
                executionId,
                workflowId,
                notebookId,
                null
        );
    }
}

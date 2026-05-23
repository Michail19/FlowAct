package com.ms.executionservice.workflow.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ms.executionservice.common.util.JsonUtils;
import com.ms.executionservice.notebooks.entity.NotebookEntity;
import com.ms.executionservice.notebooks.repository.NotebookRepository;
import com.ms.executionservice.workflow.dto.response.WorkflowValidationResponse;
import com.ms.executionservice.workflow.entity.WorkflowBlockEntity;
import com.ms.executionservice.workflow.entity.WorkflowConnectionEntity;
import com.ms.executionservice.workflow.entity.WorkflowEntity;
import com.ms.executionservice.workflow.enumtype.BlockType;
import com.ms.executionservice.workflow.enumtype.WorkflowStatus;
import com.ms.executionservice.workflow.repository.WorkflowBlockRepository;
import com.ms.executionservice.workflow.repository.WorkflowConnectionRepository;
import com.ms.executionservice.workflow.repository.WorkflowRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class WorkflowServiceTest {

    private NotebookRepository notebookRepository;
    private WorkflowRepository workflowRepository;
    private WorkflowBlockRepository workflowBlockRepository;
    private WorkflowConnectionRepository workflowConnectionRepository;
    private WorkflowService workflowService;

    private UUID userId;
    private UUID notebookId;
    private UUID workflowId;
    private NotebookEntity notebook;
    private WorkflowEntity workflow;

    @BeforeEach
    void setUp() {
        notebookRepository = mock(NotebookRepository.class);
        workflowRepository = mock(WorkflowRepository.class);
        workflowBlockRepository = mock(WorkflowBlockRepository.class);
        workflowConnectionRepository = mock(WorkflowConnectionRepository.class);

        workflowService = new WorkflowService(
                notebookRepository,
                workflowRepository,
                workflowBlockRepository,
                workflowConnectionRepository,
                new JsonUtils(new ObjectMapper())
        );

        userId = UUID.randomUUID();
        notebookId = UUID.randomUUID();
        workflowId = UUID.randomUUID();

        notebook = NotebookEntity.builder()
                .id(notebookId)
                .ownerUserId(userId)
                .name("Test notebook")
                .build();

        workflow = WorkflowEntity.builder()
                .id(workflowId)
                .notebook(notebook)
                .name("Test workflow")
                .status(WorkflowStatus.DRAFT)
                .metadata("{}")
                .build();

        when(notebookRepository.findByIdAndOwnerUserId(notebookId, userId))
                .thenReturn(Optional.of(notebook));
        when(workflowRepository.findByIdAndNotebook_Id(workflowId, notebookId))
                .thenReturn(Optional.of(workflow));
    }

    @Test
    void validateReturnsValidForSimpleLinearWorkflow() {
        WorkflowBlockEntity start = block(BlockType.START, "Start");
        WorkflowBlockEntity setVariable = block(BlockType.SET_VARIABLE, "Set variable");
        WorkflowBlockEntity end = block(BlockType.END, "End");

        when(workflowBlockRepository.findByWorkflow_Id(workflowId))
                .thenReturn(List.of(start, setVariable, end));
        when(workflowConnectionRepository.findByWorkflow_Id(workflowId))
                .thenReturn(List.of(
                        connection(start, setVariable, null),
                        connection(setVariable, end, null)
                ));

        WorkflowValidationResponse response = workflowService.validate(userId, notebookId, workflowId);

        assertThat(response.valid()).isTrue();
        assertThat(response.errors()).isEmpty();
    }

    @Test
    void validateRejectsWorkflowWithCycle() {
        WorkflowBlockEntity start = block(BlockType.START, "Start");
        WorkflowBlockEntity first = block(BlockType.SET_VARIABLE, "First");
        WorkflowBlockEntity second = block(BlockType.LOG_MESSAGE, "Second");
        WorkflowBlockEntity end = block(BlockType.END, "End");

        when(workflowBlockRepository.findByWorkflow_Id(workflowId))
                .thenReturn(List.of(start, first, second, end));
        when(workflowConnectionRepository.findByWorkflow_Id(workflowId))
                .thenReturn(List.of(
                        connection(start, first, null),
                        connection(first, second, null),
                        connection(second, first, null)
                ));

        WorkflowValidationResponse response = workflowService.validate(userId, notebookId, workflowId);

        assertThat(response.valid()).isFalse();
        assertThat(response.errors())
                .anyMatch(error -> error.contains("Cycle detected"));
    }

    @Test
    void validateRejectsIfBlockWithoutTrueAndFalseBranches() {
        WorkflowBlockEntity start = block(BlockType.START, "Start");
        WorkflowBlockEntity ifBlock = block(BlockType.IF, "If");
        WorkflowBlockEntity end = block(BlockType.END, "End");

        when(workflowBlockRepository.findByWorkflow_Id(workflowId))
                .thenReturn(List.of(start, ifBlock, end));
        when(workflowConnectionRepository.findByWorkflow_Id(workflowId))
                .thenReturn(List.of(
                        connection(start, ifBlock, null),
                        connection(ifBlock, end, "true"),
                        connection(ifBlock, end, "maybe")
                ));

        WorkflowValidationResponse response = workflowService.validate(userId, notebookId, workflowId);

        assertThat(response.valid()).isFalse();
        assertThat(response.errors())
                .anyMatch(error -> error.contains("IF block must have outgoing branches"));
    }

    private WorkflowBlockEntity block(BlockType type, String name) {
        return WorkflowBlockEntity.builder()
                .id(UUID.randomUUID())
                .workflow(workflow)
                .type(type)
                .name(name)
                .position("{}")
                .config("{}")
                .build();
    }

    private WorkflowConnectionEntity connection(
            WorkflowBlockEntity from,
            WorkflowBlockEntity to,
            String condition
    ) {
        return WorkflowConnectionEntity.builder()
                .id(UUID.randomUUID())
                .workflow(workflow)
                .fromBlock(from)
                .toBlock(to)
                .condition(condition)
                .createdAt(OffsetDateTime.now())
                .build();
    }
}

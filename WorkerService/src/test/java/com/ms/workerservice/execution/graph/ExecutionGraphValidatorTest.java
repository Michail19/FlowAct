package com.ms.workerservice.execution.graph;

import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.entity.WorkflowConnectionEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class ExecutionGraphValidatorTest {

    private ExecutionGraphBuilder graphBuilder;
    private ExecutionGraphValidator graphValidator;

    @BeforeEach
    void setUp() {
        graphBuilder = new ExecutionGraphBuilder();
        graphValidator = new ExecutionGraphValidator();
    }

    @Test
    void shouldValidateSimpleLinearWorkflow() {
        WorkflowBlockEntity start = block(BlockType.START, "Start");
        WorkflowBlockEntity map = block(BlockType.MAP, "Map");
        WorkflowBlockEntity end = block(BlockType.END, "End");

        List<WorkflowBlockEntity> blocks = List.of(start, map, end);
        List<WorkflowConnectionEntity> connections = List.of(
                connection(start, map, null),
                connection(map, end, null)
        );

        ExecutionGraph graph = graphBuilder.build(blocks, connections);

        assertDoesNotThrow(() -> graphValidator.validate(graph));
    }

    @Test
    void shouldFailWhenWorkflowHasNoEndBlock() {
        WorkflowBlockEntity start = block(BlockType.START, "Start");
        WorkflowBlockEntity map = block(BlockType.MAP, "Map");

        List<WorkflowBlockEntity> blocks = List.of(start, map);
        List<WorkflowConnectionEntity> connections = List.of(
                connection(start, map, null)
        );

        ExecutionGraph graph = graphBuilder.build(blocks, connections);

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> graphValidator.validate(graph)
        );

        assertTrue(ex.getMessage().contains("no END block"));
    }

    @Test
    void shouldFailWhenIfBlockHasNoTrueFalseBranches() {
        WorkflowBlockEntity start = block(BlockType.START, "Start");
        WorkflowBlockEntity ifBlock = block(BlockType.IF, "If");
        WorkflowBlockEntity end = block(BlockType.END, "End");
        WorkflowBlockEntity end2 = block(BlockType.END, "End2");

        List<WorkflowBlockEntity> blocks = List.of(start, ifBlock, end, end2);
        List<WorkflowConnectionEntity> connections = List.of(
                connection(start, ifBlock, null),
                connection(ifBlock, end, "yes"),
                connection(ifBlock, end2, "no")
        );

        ExecutionGraph graph = graphBuilder.build(blocks, connections);

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> graphValidator.validate(graph)
        );

        assertTrue(ex.getMessage().contains("true") || ex.getMessage().contains("false"));
    }

    @Test
    void shouldFailWhenSwitchHasNoDefaultBranch() {
        WorkflowBlockEntity start = block(BlockType.START, "Start");
        WorkflowBlockEntity switchBlock = block(BlockType.SWITCH, "Switch");
        WorkflowBlockEntity end1 = block(BlockType.END, "End1");
        WorkflowBlockEntity end2 = block(BlockType.END, "End2");

        List<WorkflowBlockEntity> blocks = List.of(start, switchBlock, end1, end2);
        List<WorkflowConnectionEntity> connections = List.of(
                connection(start, switchBlock, null),
                connection(switchBlock, end1, "approved"),
                connection(switchBlock, end2, "rejected")
        );

        ExecutionGraph graph = graphBuilder.build(blocks, connections);

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> graphValidator.validate(graph)
        );

        assertTrue(ex.getMessage().contains("default"));
    }

    @Test
    void shouldFailWhenMergeHasLessThanTwoInputs() {
        WorkflowBlockEntity start = block(BlockType.START, "Start");
        WorkflowBlockEntity merge = block(BlockType.MERGE, "Merge");
        WorkflowBlockEntity end = block(BlockType.END, "End");

        List<WorkflowBlockEntity> blocks = List.of(start, merge, end);
        List<WorkflowConnectionEntity> connections = List.of(
                connection(start, merge, null),
                connection(merge, end, null)
        );

        ExecutionGraph graph = graphBuilder.build(blocks, connections);

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> graphValidator.validate(graph)
        );

        assertTrue(ex.getMessage().contains("MERGE"));
    }

    @Test
    void shouldFailWhenCycleExists() {
        WorkflowBlockEntity start = block(BlockType.START, "Start");
        WorkflowBlockEntity map1 = block(BlockType.MAP, "Map1");
        WorkflowBlockEntity map2 = block(BlockType.MAP, "Map2");
        WorkflowBlockEntity end = block(BlockType.END, "End");

        List<WorkflowBlockEntity> blocks = List.of(start, map1, map2, end);
        List<WorkflowConnectionEntity> connections = List.of(
                connection(start, map1, null),
                connection(map1, map2, null),
                connection(map2, map1, null),
                connection(map2, end, null)
        );

        ExecutionGraph graph = graphBuilder.build(blocks, connections);

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> graphValidator.validate(graph)
        );

        assertTrue(ex.getMessage().contains("Cycle"));
    }

    private WorkflowBlockEntity block(BlockType type, String name) {
        return WorkflowBlockEntity.builder()
                .id(UUID.randomUUID())
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
                .fromBlock(from)
                .toBlock(to)
                .condition(condition)
                .createdAt(OffsetDateTime.now())
                .build();
    }
}

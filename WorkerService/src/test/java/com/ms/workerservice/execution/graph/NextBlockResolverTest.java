package com.ms.workerservice.execution.graph;

import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.entity.WorkflowConnectionEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class NextBlockResolverTest {

    private ExecutionGraphBuilder graphBuilder;
    private NextBlockResolver nextBlockResolver;

    @BeforeEach
    void setUp() {
        graphBuilder = new ExecutionGraphBuilder();
        nextBlockResolver = new NextBlockResolver();
    }

    @Test
    void shouldResolveLinearNextBlock() {
        WorkflowBlockEntity start = block(BlockType.START, "Start");
        WorkflowBlockEntity map = block(BlockType.MAP, "Map");
        WorkflowBlockEntity end = block(BlockType.END, "End");

        ExecutionGraph graph = graphBuilder.build(
                List.of(start, map, end),
                List.of(
                        connection(start, map, null),
                        connection(map, end, null)
                )
        );

        WorkflowBlockEntity next = nextBlockResolver.resolveNextBlock(
                graph,
                start,
                NodeResult.empty()
        );

        assertEquals(map.getId(), next.getId());
    }

    @Test
    void shouldResolveIfTrueBranch() {
        WorkflowBlockEntity ifBlock = block(BlockType.IF, "If");
        WorkflowBlockEntity trueEnd = block(BlockType.END, "TrueEnd");
        WorkflowBlockEntity falseEnd = block(BlockType.END, "FalseEnd");
        WorkflowBlockEntity start = block(BlockType.START, "Start");

        ExecutionGraph graph = graphBuilder.build(
                List.of(start, ifBlock, trueEnd, falseEnd),
                List.of(
                        connection(start, ifBlock, null),
                        connection(ifBlock, trueEnd, "true"),
                        connection(ifBlock, falseEnd, "false")
                )
        );

        WorkflowBlockEntity next = nextBlockResolver.resolveNextBlock(
                graph,
                ifBlock,
                NodeResult.of(null, "true")
        );

        assertEquals(trueEnd.getId(), next.getId());
    }

    @Test
    void shouldResolveIfFalseBranch() {
        WorkflowBlockEntity ifBlock = block(BlockType.IF, "If");
        WorkflowBlockEntity trueEnd = block(BlockType.END, "TrueEnd");
        WorkflowBlockEntity falseEnd = block(BlockType.END, "FalseEnd");
        WorkflowBlockEntity start = block(BlockType.START, "Start");

        ExecutionGraph graph = graphBuilder.build(
                List.of(start, ifBlock, trueEnd, falseEnd),
                List.of(
                        connection(start, ifBlock, null),
                        connection(ifBlock, trueEnd, "true"),
                        connection(ifBlock, falseEnd, "false")
                )
        );

        WorkflowBlockEntity next = nextBlockResolver.resolveNextBlock(
                graph,
                ifBlock,
                NodeResult.of(null, "false")
        );

        assertEquals(falseEnd.getId(), next.getId());
    }

    @Test
    void shouldResolveSwitchExactBranch() {
        WorkflowBlockEntity start = block(BlockType.START, "Start");
        WorkflowBlockEntity switchBlock = block(BlockType.SWITCH, "Switch");
        WorkflowBlockEntity approved = block(BlockType.END, "Approved");
        WorkflowBlockEntity rejected = block(BlockType.END, "Rejected");
        WorkflowBlockEntity fallback = block(BlockType.END, "Fallback");

        ExecutionGraph graph = graphBuilder.build(
                List.of(start, switchBlock, approved, rejected, fallback),
                List.of(
                        connection(start, switchBlock, null),
                        connection(switchBlock, approved, "approved"),
                        connection(switchBlock, rejected, "rejected"),
                        connection(switchBlock, fallback, "default")
                )
        );

        WorkflowBlockEntity next = nextBlockResolver.resolveNextBlock(
                graph,
                switchBlock,
                NodeResult.of(null, "approved")
        );

        assertEquals(approved.getId(), next.getId());
    }

    @Test
    void shouldResolveSwitchDefaultBranch() {
        WorkflowBlockEntity start = block(BlockType.START, "Start");
        WorkflowBlockEntity switchBlock = block(BlockType.SWITCH, "Switch");
        WorkflowBlockEntity approved = block(BlockType.END, "Approved");
        WorkflowBlockEntity fallback = block(BlockType.END, "Fallback");

        ExecutionGraph graph = graphBuilder.build(
                List.of(start, switchBlock, approved, fallback),
                List.of(
                        connection(start, switchBlock, null),
                        connection(switchBlock, approved, "approved"),
                        connection(switchBlock, fallback, "default")
                )
        );

        WorkflowBlockEntity next = nextBlockResolver.resolveNextBlock(
                graph,
                switchBlock,
                NodeResult.of(null, "unknown-case")
        );

        assertEquals(fallback.getId(), next.getId());
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

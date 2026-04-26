package com.ms.workerservice.execution.graph;

import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.entity.WorkflowConnectionEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Component
public class ExecutionGraphValidator {

    public void validate(ExecutionGraph graph) {
        validateStartBlock(graph);
        validateEndBlocks(graph);
        validateRequiredOutgoingConnections(graph);
        validateBlockTypeRules(graph);
        validateReachabilityAndCycles(graph);
    }

    private void validateStartBlock(ExecutionGraph graph) {
        WorkflowBlockEntity startBlock = graph.getStartBlock();

        if (!graph.getIncomingConnections(startBlock.getId()).isEmpty()) {
            throw new IllegalStateException("START block must not have incoming connections");
        }

        if (graph.getOutgoingConnections(startBlock.getId()).isEmpty()) {
            throw new IllegalStateException("START block must have outgoing connection");
        }
    }

    private void validateEndBlocks(ExecutionGraph graph) {
        List<WorkflowBlockEntity> endBlocks = graph.getBlocks().stream()
                .filter(block -> block.getType() == BlockType.END)
                .toList();

        if (endBlocks.isEmpty()) {
            throw new IllegalStateException("Workflow has no END block");
        }

        for (WorkflowBlockEntity endBlock : endBlocks) {
            if (!graph.getOutgoingConnections(endBlock.getId()).isEmpty()) {
                throw new IllegalStateException("END block must not have outgoing connections: " + endBlock.getId());
            }
        }
    }

    private void validateRequiredOutgoingConnections(ExecutionGraph graph) {
        for (WorkflowBlockEntity block : graph.getBlocks()) {
            if (block.getType() == BlockType.END) {
                continue;
            }

            if (graph.getOutgoingConnections(block.getId()).isEmpty()) {
                throw new IllegalStateException("Block has no outgoing connection: " + block.getId());
            }
        }
    }

    private void validateReachabilityAndCycles(ExecutionGraph graph) {
        Set<UUID> visiting = new HashSet<>();
        Set<UUID> visited = new HashSet<>();
        boolean endReachable = dfs(graph, graph.getStartBlock(), visiting, visited);

        if (!endReachable) {
            throw new IllegalStateException("END block is not reachable from START");
        }

        if (visited.size() != graph.getBlocks().size()) {
            throw new IllegalStateException("Workflow contains unreachable blocks");
        }
    }

    private void validateBlockTypeRules(ExecutionGraph graph) {
        for (WorkflowBlockEntity block : graph.getBlocks()) {
            switch (block.getType()) {
                case IF -> validateIfBlock(graph, block);
                case SWITCH -> validateSwitchBlock(graph, block);
                case MERGE -> validateMergeBlock(graph, block);
                default -> {
                }
            }
        }
    }

    private void validateIfBlock(ExecutionGraph graph, WorkflowBlockEntity block) {
        List<WorkflowConnectionEntity> outgoing = graph.getOutgoingConnections(block.getId());

        if (outgoing.size() < 2) {
            throw new IllegalStateException("IF block must have at least 2 outgoing connections: " + block.getId());
        }

        boolean hasTrue = outgoing.stream()
                .anyMatch(connection -> "true".equalsIgnoreCase(normalizeCondition(connection.getCondition())));

        boolean hasFalse = outgoing.stream()
                .anyMatch(connection -> "false".equalsIgnoreCase(normalizeCondition(connection.getCondition())));

        if (!hasTrue || !hasFalse) {
            throw new IllegalStateException(
                    "IF block must have outgoing branches with conditions 'true' and 'false': " + block.getId()
            );
        }
    }

    private void validateSwitchBlock(ExecutionGraph graph, WorkflowBlockEntity block) {
        List<WorkflowConnectionEntity> outgoing = graph.getOutgoingConnections(block.getId());

        if (outgoing.size() < 2) {
            throw new IllegalStateException("SWITCH block must have at least 2 outgoing connections: " + block.getId());
        }

        boolean hasDefault = outgoing.stream()
                .anyMatch(connection -> "default".equalsIgnoreCase(normalizeCondition(connection.getCondition())));

        if (!hasDefault) {
            throw new IllegalStateException(
                    "SWITCH block should have a 'default' outgoing branch: " + block.getId()
            );
        }

        long blankConditions = outgoing.stream()
                .filter(connection -> normalizeCondition(connection.getCondition()).isBlank())
                .count();

        if (blankConditions > 0) {
            throw new IllegalStateException(
                    "SWITCH block must not have blank conditions on outgoing connections: " + block.getId()
            );
        }
    }

    private void validateMergeBlock(ExecutionGraph graph, WorkflowBlockEntity block) {
        List<WorkflowConnectionEntity> incoming = graph.getIncomingConnections(block.getId());
        List<WorkflowConnectionEntity> outgoing = graph.getOutgoingConnections(block.getId());

        if (incoming.size() < 2) {
            throw new IllegalStateException("MERGE block must have at least 2 incoming connections: " + block.getId());
        }

        if (outgoing.size() != 1) {
            throw new IllegalStateException("MERGE block must have exactly 1 outgoing connection: " + block.getId());
        }
    }

    private String normalizeCondition(String condition) {
        if (condition == null) {
            return "";
        }
        return condition.trim().toLowerCase();
    }

    private boolean dfs(
            ExecutionGraph graph,
            WorkflowBlockEntity currentBlock,
            Set<UUID> visiting,
            Set<UUID> visited
    ) {
        UUID currentBlockId = currentBlock.getId();

        if (visiting.contains(currentBlockId)) {
            throw new IllegalStateException("Cycle detected near block: " + currentBlockId);
        }

        if (visited.contains(currentBlockId)) {
            return currentBlock.getType() == BlockType.END;
        }

        visiting.add(currentBlockId);

        boolean endReachable = currentBlock.getType() == BlockType.END;

        for (WorkflowConnectionEntity connection : graph.getOutgoingConnections(currentBlockId)) {
            WorkflowBlockEntity nextBlock = graph.getBlock(connection.getToBlock().getId());

            if (nextBlock == null) {
                throw new IllegalStateException("Connection points to missing block: " + connection.getToBlock().getId());
            }

            if (dfs(graph, nextBlock, visiting, visited)) {
                endReachable = true;
            }
        }

        visiting.remove(currentBlockId);
        visited.add(currentBlockId);

        return endReachable;
    }
}

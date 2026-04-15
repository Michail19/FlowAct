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

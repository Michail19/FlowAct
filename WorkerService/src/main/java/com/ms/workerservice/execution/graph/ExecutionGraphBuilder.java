package com.ms.workerservice.execution.graph;

import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.entity.WorkflowConnectionEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class ExecutionGraphBuilder {

    public ExecutionGraph build(
            List<WorkflowBlockEntity> blocks,
            List<WorkflowConnectionEntity> connections
    ) {
        if (blocks == null || blocks.isEmpty()) {
            throw new IllegalStateException("Workflow contains no blocks");
        }

        Map<UUID, WorkflowBlockEntity> blocksById = buildBlocksById(blocks);
        Map<UUID, List<WorkflowConnectionEntity>> outgoingConnections =
                buildOutgoingConnections(connections, blocksById);

        WorkflowBlockEntity startBlock = findStartBlock(blocks);

        return new ExecutionGraph(
                blocksById,
                outgoingConnections,
                startBlock
        );
    }

    private Map<UUID, WorkflowBlockEntity> buildBlocksById(List<WorkflowBlockEntity> blocks) {
        Map<UUID, WorkflowBlockEntity> blocksById = new HashMap<>();

        for (WorkflowBlockEntity block : blocks) {
            if (blocksById.containsKey(block.getId())) {
                throw new IllegalStateException("Duplicate block id: " + block.getId());
            }

            blocksById.put(block.getId(), block);
        }

        return blocksById;
    }

    private Map<UUID, List<WorkflowConnectionEntity>> buildOutgoingConnections(
            List<WorkflowConnectionEntity> connections,
            Map<UUID, WorkflowBlockEntity> blocksById
    ) {
        Map<UUID, List<WorkflowConnectionEntity>> outgoingConnections = new HashMap<>();

        if (connections == null) {
            return outgoingConnections;
        }

        for (WorkflowConnectionEntity connection : connections) {
            UUID fromBlockId = connection.getFromBlock().getId();
            UUID toBlockId = connection.getToBlock().getId();

            if (!blocksById.containsKey(fromBlockId)) {
                throw new IllegalStateException("Connection references missing fromBlock: " + fromBlockId);
            }

            if (!blocksById.containsKey(toBlockId)) {
                throw new IllegalStateException("Connection references missing toBlock: " + toBlockId);
            }

            outgoingConnections
                    .computeIfAbsent(fromBlockId, key -> new ArrayList<>())
                    .add(connection);
        }

        return outgoingConnections;
    }

    private WorkflowBlockEntity findStartBlock(List<WorkflowBlockEntity> blocks) {
        List<WorkflowBlockEntity> startBlocks = blocks.stream()
                .filter(block -> block.getType() == BlockType.START)
                .toList();

        if (startBlocks.isEmpty()) {
            throw new IllegalStateException("Workflow has no START block");
        }

        if (startBlocks.size() > 1) {
            throw new IllegalStateException("Workflow has more than one START block");
        }

        return startBlocks.getFirst();
    }
}

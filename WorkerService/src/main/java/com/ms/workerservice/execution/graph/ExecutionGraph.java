package com.ms.workerservice.execution.graph;

import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.entity.WorkflowConnectionEntity;
import lombok.Getter;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public class ExecutionGraph {

    private final Map<UUID, WorkflowBlockEntity> blocksById;
    private final Map<UUID, List<WorkflowConnectionEntity>> outgoingConnections;
    private final Map<UUID, List<WorkflowConnectionEntity>> incomingConnections;

    @Getter
    private final WorkflowBlockEntity startBlock;

    public ExecutionGraph(
            Map<UUID, WorkflowBlockEntity> blocksById,
            Map<UUID, List<WorkflowConnectionEntity>> outgoingConnections,
            Map<UUID, List<WorkflowConnectionEntity>> incomingConnections,
            WorkflowBlockEntity startBlock
    ) {
        this.blocksById = blocksById;
        this.outgoingConnections = outgoingConnections;
        this.incomingConnections = incomingConnections;
        this.startBlock = startBlock;
    }

    public List<WorkflowBlockEntity> getBlocks() {
        return List.copyOf(blocksById.values());
    }

    public WorkflowBlockEntity getBlock(UUID blockId) {
        return blocksById.get(blockId);
    }

    public List<WorkflowConnectionEntity> getOutgoingConnections(UUID blockId) {
        return outgoingConnections.getOrDefault(blockId, List.of());
    }

    public List<WorkflowConnectionEntity> getIncomingConnections(UUID blockId) {
        return incomingConnections.getOrDefault(blockId, List.of());
    }
}

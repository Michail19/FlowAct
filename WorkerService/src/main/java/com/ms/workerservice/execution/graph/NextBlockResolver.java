package com.ms.workerservice.execution.graph;

import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.entity.WorkflowConnectionEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

@Component
public class NextBlockResolver {

    public WorkflowBlockEntity resolveNextBlock(
            ExecutionGraph graph,
            WorkflowBlockEntity currentBlock
    ) {
        if (currentBlock.getType() == BlockType.END) {
            return null;
        }

        List<WorkflowConnectionEntity> nextConnections =
                graph.getOutgoingConnections(currentBlock.getId());

        if (nextConnections.isEmpty()) {
            throw new IllegalStateException("Block has no outgoing connection: " + currentBlock.getId());
        }

        if (requiresSingleOutgoing(currentBlock) && nextConnections.size() > 1) {
            throw new IllegalStateException(
                    "Block has more than one outgoing connection but current resolver supports only one: "
                            + currentBlock.getId()
            );
        }

        WorkflowConnectionEntity nextConnection = nextConnections.get(0);
        UUID nextBlockId = nextConnection.getToBlock().getId();

        WorkflowBlockEntity nextBlock = graph.getBlock(nextBlockId);

        if (nextBlock == null) {
            throw new IllegalStateException("Connection points to missing block: " + nextBlockId);
        }

        return nextBlock;
    }

    private boolean requiresSingleOutgoing(WorkflowBlockEntity block) {
        return switch (block.getType()) {
            case START, INPUT, SET_VARIABLE, MAP, FILTER, TRANSFORM_JSON,
                 HTTP_REQUEST, LLM_REQUEST, ML_REQUEST, DELAY, WAIT, WEBHOOK, MERGE -> true;
            case IF, SWITCH -> false;
            case END -> false;
        };
    }
}

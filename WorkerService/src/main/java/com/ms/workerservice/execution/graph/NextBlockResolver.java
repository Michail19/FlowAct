package com.ms.workerservice.execution.graph;

import com.ms.workerservice.execution.engine.NodeResult;
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
            WorkflowBlockEntity currentBlock,
            NodeResult result
    ) {
        if (currentBlock.getType() == BlockType.END) {
            return null;
        }

        List<WorkflowConnectionEntity> nextConnections =
                graph.getOutgoingConnections(currentBlock.getId());

        if (nextConnections.isEmpty()) {
            throw new IllegalStateException("Block has no outgoing connection: " + currentBlock.getId());
        }

        WorkflowConnectionEntity nextConnection;

        if (currentBlock.getType() == BlockType.IF) {
            nextConnection = resolveIfConnection(currentBlock, nextConnections, result);
        } else if (currentBlock.getType() == BlockType.SWITCH) {
            nextConnection = resolveSwitchConnection(currentBlock, nextConnections, result);
        } else {
            if (requiresSingleOutgoing(currentBlock) && nextConnections.size() > 1) {
                throw new IllegalStateException(
                        "Block has more than one outgoing connection but current resolver supports only one: "
                                + currentBlock.getId()
                );
            }

            nextConnection = nextConnections.get(0);
        }

        UUID nextBlockId = nextConnection.getToBlock().getId();

        WorkflowBlockEntity nextBlock = graph.getBlock(nextBlockId);

        if (nextBlock == null) {
            throw new IllegalStateException("Connection points to missing block: " + nextBlockId);
        }

        return nextBlock;
    }

    private WorkflowConnectionEntity resolveIfConnection(
            WorkflowBlockEntity currentBlock,
            List<WorkflowConnectionEntity> nextConnections,
            NodeResult result
    ) {
        String selectedBranch = result != null ? result.getSelectedBranch() : null;

        if (selectedBranch == null || selectedBranch.isBlank()) {
            throw new IllegalStateException("IF block did not provide selected branch: " + currentBlock.getId());
        }

        return nextConnections.stream()
                .filter(connection -> selectedBranch.equalsIgnoreCase(normalizeCondition(connection.getCondition())))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "No outgoing connection matches IF branch '" + selectedBranch
                                + "' for block: " + currentBlock.getId()
                ));
    }

    private WorkflowConnectionEntity resolveSwitchConnection(
            WorkflowBlockEntity currentBlock,
            List<WorkflowConnectionEntity> nextConnections,
            NodeResult result
    ) {
        String selectedBranch = result != null ? result.getSelectedBranch() : null;

        if (selectedBranch == null || selectedBranch.isBlank()) {
            selectedBranch = "default";
        }

        String finalSelectedBranch = selectedBranch;

        return nextConnections.stream()
                .filter(connection -> finalSelectedBranch.equalsIgnoreCase(normalizeCondition(connection.getCondition())))
                .findFirst()
                .or(() -> nextConnections.stream()
                        .filter(connection -> "default".equalsIgnoreCase(normalizeCondition(connection.getCondition())))
                        .findFirst())
                .orElseThrow(() -> new IllegalStateException(
                        "No outgoing connection matches SWITCH branch '" + finalSelectedBranch
                                + "' and no 'default' branch found for block: " + currentBlock.getId()
                ));
    }

    private String normalizeCondition(String condition) {
        if (condition == null) {
            return "";
        }
        return condition.trim().toLowerCase();
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

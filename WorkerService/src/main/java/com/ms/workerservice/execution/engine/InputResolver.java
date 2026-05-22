package com.ms.workerservice.execution.engine;

import com.ms.workerservice.execution.graph.ExecutionGraph;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.entity.WorkflowConnectionEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class InputResolver {

    public ResolvedInput resolve(
            ExecutionGraph graph,
            WorkflowBlockEntity block,
            ExecutionContext context
    ) {
        Map<String, Object> resolvedValues = new LinkedHashMap<>();
        Map<String, Object> inputs = new LinkedHashMap<>();

        List<WorkflowConnectionEntity> incomingConnections =
                graph.getIncomingConnections(block.getId());

        for (WorkflowConnectionEntity connection : incomingConnections) {
            UUID sourceBlockId = connection.getFromBlock().getId();
            Object sourceOutput = context.getBlockOutput(sourceBlockId);

            if (sourceOutput != null) {
                inputs.put(sourceBlockId.toString(), sourceOutput);
            }
        }

        Object mainInput = resolveMainInput(block, context, inputs);

        resolvedValues.put("input", context.getExecutionInput());
        resolvedValues.put("executionInput", context.getExecutionInput());
        resolvedValues.put("value", mainInput);
        resolvedValues.put("condition", mainInput);
        resolvedValues.put("inputs", inputs);
        resolvedValues.put("output", context.getLastSuccessfulOutput());
        resolvedValues.put("last", context.getLastSuccessfulOutput());
        resolvedValues.put("outputs", context.getBlockOutputsByStringId());
        resolvedValues.put("variables", context.getVariables());

        return new ResolvedInput(resolvedValues);
    }

    private Object resolveMainInput(
            WorkflowBlockEntity block,
            ExecutionContext context,
            Map<String, Object> inputs
    ) {
        if (block.getType() == BlockType.START) {
            return context.getExecutionInput();
        }

        if (inputs.size() == 1) {
            return inputs.values().iterator().next();
        }

        if (!inputs.isEmpty()) {
            return inputs;
        }

        return context.getExecutionInput();
    }
}

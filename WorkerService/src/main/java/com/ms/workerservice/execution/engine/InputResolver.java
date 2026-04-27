package com.ms.workerservice.execution.engine;

import com.ms.workerservice.execution.graph.ExecutionGraph;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.entity.WorkflowConnectionEntity;
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

        resolvedValues.put("inputs", inputs);
        resolvedValues.put("variables", context.getVariables());

        if (inputs.size() == 1) {
            Object singleValue = inputs.values().iterator().next();
            resolvedValues.put("value", singleValue);
            resolvedValues.put("condition", singleValue);
        }

        return new ResolvedInput(resolvedValues);
    }
}

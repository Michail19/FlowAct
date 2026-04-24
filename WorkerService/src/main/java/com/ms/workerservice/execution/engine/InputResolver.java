package com.ms.workerservice.execution.engine;

import com.ms.workerservice.execution.graph.ExecutionGraph;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.entity.WorkflowConnectionEntity;
import org.springframework.stereotype.Component;

import java.util.HashMap;
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
        Map<String, Object> resolvedValues = new HashMap<>();

        List<WorkflowConnectionEntity> incomingConnections =
                graph.getIncomingConnections(block.getId());

        for (WorkflowConnectionEntity connection : incomingConnections) {
            UUID sourceBlockId = connection.getFromBlock().getId();
            Object sourceOutput = context.getBlockOutput(sourceBlockId);

            if (sourceOutput != null) {
                resolvedValues.put(sourceBlockId.toString(), sourceOutput);
            }
        }

        return new ResolvedInput(resolvedValues);
    }
}

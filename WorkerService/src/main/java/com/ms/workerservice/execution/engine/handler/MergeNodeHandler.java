package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class MergeNodeHandler implements NodeHandler {

    @Override
    public BlockType getSupportedType() {
        return BlockType.MERGE;
    }

    @Override
    public NodeResult handle(
            WorkflowBlockEntity block,
            ResolvedInput input,
            ExecutionContext context
    ) {
        if (input.getValue() != null) {
            return NodeResult.of(input.getValue());
        }

        if (!input.getInputs().isEmpty()) {
            if (input.getInputs().size() == 1) {
                return NodeResult.of(input.getInputs().values().iterator().next());
            }

            Map<String, Object> merged = new LinkedHashMap<>(input.getInputs());
            return NodeResult.of(merged);
        }

        return NodeResult.empty();
    }
}

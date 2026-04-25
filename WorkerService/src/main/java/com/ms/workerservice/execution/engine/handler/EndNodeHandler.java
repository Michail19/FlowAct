package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.stereotype.Component;

@Component
public class EndNodeHandler implements NodeHandler {

    @Override
    public BlockType getSupportedType() {
        return BlockType.END;
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
            return NodeResult.of(input.getInputs());
        }

        return NodeResult.empty();
    }
}

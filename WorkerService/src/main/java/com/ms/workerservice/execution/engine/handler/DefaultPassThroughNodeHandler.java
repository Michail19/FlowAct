package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.stereotype.Component;

@Component
public class DefaultPassThroughNodeHandler implements NodeHandler {

    @Override
    public BlockType getSupportedType() {
        return BlockType.INPUT;
    }

    @Override
    public NodeResult handle(WorkflowBlockEntity block, ExecutionContext context) {
        return NodeResult.empty();
    }
}

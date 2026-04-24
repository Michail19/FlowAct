package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;

public interface NodeHandler {

    BlockType getSupportedType();

    NodeResult handle(WorkflowBlockEntity block, ExecutionContext context);
}

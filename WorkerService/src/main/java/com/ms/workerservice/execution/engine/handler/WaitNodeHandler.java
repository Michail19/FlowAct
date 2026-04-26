package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class WaitNodeHandler implements NodeHandler {

    private final JsonHelper jsonHelper;

    public WaitNodeHandler(JsonHelper jsonHelper) {
        this.jsonHelper = jsonHelper;
    }

    @Override
    public BlockType getSupportedType() {
        return BlockType.WAIT;
    }

    @Override
    public NodeResult handle(
            WorkflowBlockEntity block,
            ResolvedInput input,
            ExecutionContext context
    ) {
        Map<String, Object> config = jsonHelper.toMap(block.getConfig());

        Map<String, Object> output = new LinkedHashMap<>();
        output.put("waitType", config.getOrDefault("waitType", "manual"));
        output.put("resumeKey", config.getOrDefault("resumeKey", block.getId().toString()));

        if (input.getValue() != null) {
            output.put("input", input.getValue());
        } else if (!input.getInputs().isEmpty()) {
            output.put("input", input.getInputs());
        }

        return NodeResult.waitResult(output);
    }
}

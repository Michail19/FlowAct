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
public class WebhookNodeHandler implements NodeHandler {

    @Override
    public BlockType getSupportedType() {
        return BlockType.WEBHOOK;
    }

    @Override
    public NodeResult handle(
            WorkflowBlockEntity block,
            ResolvedInput input,
            ExecutionContext context
    ) {
        Map<String, Object> output = new LinkedHashMap<>();
        output.put("mode", "manual");
        output.put("message", "WEBHOOK block executed in manual workflow mode");
        output.put("payload", input.getValue() != null ? input.getValue() : input.getValues());

        return NodeResult.of(output);
    }
}

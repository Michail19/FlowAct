package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class SetVariableNodeHandler implements NodeHandler {

    private final JsonHelper jsonHelper;

    public SetVariableNodeHandler(JsonHelper jsonHelper) {
        this.jsonHelper = jsonHelper;
    }

    @Override
    public BlockType getSupportedType() {
        return BlockType.SET_VARIABLE;
    }

    @Override
    public NodeResult handle(
            WorkflowBlockEntity block,
            ResolvedInput input,
            ExecutionContext context
    ) {
        Map<String, Object> config = jsonHelper.toMap(block.getConfig());

        String variableName = resolveVariableName(config);
        Object value = resolveValue(input, config);

        context.putVariable(variableName, value);

        return NodeResult.of(Map.of(
                "variableName", variableName,
                "value", value
        ));
    }

    private String resolveVariableName(Map<String, Object> config) {
        Object variableName = config.get("variableName");

        if (variableName == null || String.valueOf(variableName).isBlank()) {
            throw new IllegalStateException("SET_VARIABLE block requires config.variableName");
        }

        return String.valueOf(variableName);
    }

    private Object resolveValue(ResolvedInput input, Map<String, Object> config) {
        if (config.containsKey("value")) {
            return config.get("value");
        }

        Object inputValue = input.getValue();
        if (inputValue != null) {
            return inputValue;
        }

        return input.getInputs();
    }
}

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
public class IfNodeHandler implements NodeHandler {

    private final JsonHelper jsonHelper;

    public IfNodeHandler(JsonHelper jsonHelper) {
        this.jsonHelper = jsonHelper;
    }

    @Override
    public BlockType getSupportedType() {
        return BlockType.IF;
    }

    @Override
    public NodeResult handle(
            WorkflowBlockEntity block,
            ResolvedInput input,
            ExecutionContext context
    ) {
        Map<String, Object> config = jsonHelper.toMap(block.getConfig());

        Object conditionValue = resolveConditionValue(config, input, context);

        boolean result = toBoolean(conditionValue);

        return NodeResult.of(
                Map.of("result", result),
                result ? "true" : "false"
        );
    }

    private Object resolveConditionValue(
            Map<String, Object> config,
            ResolvedInput input,
            ExecutionContext context
    ) {
        Object variableName = config.get("variableName");
        if (variableName != null && !String.valueOf(variableName).isBlank()) {
            return context.getVariable(String.valueOf(variableName));
        }

        Object inputKey = config.get("inputKey");
        if (inputKey != null && !String.valueOf(inputKey).isBlank()) {
            String key = String.valueOf(inputKey);

            if (input.get(key) != null) {
                return input.get(key);
            }

            if (input.getInputs().containsKey(key)) {
                return input.getInputs().get(key);
            }
        }

        if (input.get("condition") != null) {
            return input.get("condition");
        }

        if (input.getValue() != null) {
            return input.getValue();
        }

        if (!input.getInputs().isEmpty()) {
            return input.getInputs().values().iterator().next();
        }

        return null;
    }

    private boolean toBoolean(Object value) {
        switch (value) {
            case null -> {
                return false;
            }
            case Boolean bool -> {
                return bool;
            }
            case Number number -> {
                return number.doubleValue() != 0;
            }
            case String str -> {
                String normalized = str.trim().toLowerCase();
                return normalized.equals("true")
                        || normalized.equals("1")
                        || normalized.equals("yes")
                        || normalized.equals("y");
            }
            default -> {
            }
        }

        return true;
    }
}

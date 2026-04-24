package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class IfNodeHandler implements NodeHandler {

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
        Object conditionValue = resolveConditionValue(input);

        boolean result = toBoolean(conditionValue);

        return NodeResult.of(
                Map.of("result", result),
                result ? "true" : "false"
        );
    }

    private Object resolveConditionValue(ResolvedInput input) {
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

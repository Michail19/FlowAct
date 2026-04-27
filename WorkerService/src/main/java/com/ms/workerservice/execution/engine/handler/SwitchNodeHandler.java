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
public class SwitchNodeHandler implements NodeHandler {

    private final JsonHelper jsonHelper;

    public SwitchNodeHandler(JsonHelper jsonHelper) {
        this.jsonHelper = jsonHelper;
    }

    @Override
    public BlockType getSupportedType() {
        return BlockType.SWITCH;
    }

    @Override
    public NodeResult handle(
            WorkflowBlockEntity block,
            ResolvedInput input,
            ExecutionContext context
    ) {
        Map<String, Object> config = jsonHelper.toMap(block.getConfig());

        Object switchValue = resolveSwitchValue(config, input, context);

        String selectedBranch = normalizeBranchValue(switchValue);

        return NodeResult.of(
                Map.of("selectedBranch", selectedBranch),
                selectedBranch
        );
    }

    private Object resolveSwitchValue(
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

        if (input.getValue() != null) {
            return input.getValue();
        }

        if (!input.getInputs().isEmpty()) {
            return input.getInputs().values().iterator().next();
        }

        return null;
    }

    private String normalizeBranchValue(Object value) {
        if (value == null) {
            return "default";
        }

        if (value instanceof String str) {
            String normalized = str.trim();
            return normalized.isBlank() ? "default" : normalized;
        }

        return String.valueOf(value);
    }
}

package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.execution.engine.TemplateRenderer;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class SetVariableNodeHandler implements NodeHandler {

    private final JsonHelper jsonHelper;
    private final TemplateRenderer templateRenderer;

    public SetVariableNodeHandler(JsonHelper jsonHelper, TemplateRenderer templateRenderer) {
        this.jsonHelper = jsonHelper;
        this.templateRenderer = templateRenderer;
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

        String variableName = resolveVariableName(config, input, context);
        Object value = resolveValue(input, context, config);

        context.putVariable(variableName, value);

        return NodeResult.of(Map.of(
                "variableName", variableName,
                "value", value
        ));
    }

    private String resolveVariableName(
            Map<String, Object> config,
            ResolvedInput input,
            ExecutionContext context
    ) {
        Object variableName = config.get("variableName");

        if (variableName == null || String.valueOf(variableName).isBlank()) {
            throw new IllegalStateException("SET_VARIABLE block requires config.variableName");
        }

        return templateRenderer.render(String.valueOf(variableName), input, context);
    }

    private Object resolveValue(
            ResolvedInput input,
            ExecutionContext context,
            Map<String, Object> config
    ) {
        if (config.containsKey("value")) {
            return templateRenderer.renderValue(config.get("value"), input, context);
        }

        if (config.containsKey("sourcePath")) {
            return resolvePath(input, String.valueOf(config.get("sourcePath")));
        }

        Object inputValue = input.getValue();
        if (inputValue != null) {
            return inputValue;
        }

        if (!input.getInputs().isEmpty()) {
            return input.getInputs();
        }

        return input.get("input");
    }

    @SuppressWarnings("unchecked")
    private Object resolvePath(ResolvedInput input, String path) {
        if (path == null || path.isBlank()) {
            return input.getValue();
        }

        Object current = input.getValues();
        for (String segment : path.trim().split("\\.")) {
            if (current == null) {
                return null;
            }

            if (current instanceof Map<?, ?> map) {
                current = ((Map<String, Object>) map).get(segment);
                continue;
            }

            if (current instanceof java.util.List<?> list) {
                try {
                    int index = Integer.parseInt(segment);
                    current = index >= 0 && index < list.size() ? list.get(index) : null;
                    continue;
                } catch (NumberFormatException ex) {
                    return null;
                }
            }

            return null;
        }

        return current;
    }
}

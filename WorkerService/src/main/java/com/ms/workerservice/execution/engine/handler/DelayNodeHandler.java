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
public class DelayNodeHandler implements NodeHandler {

    private static final long MAX_DELAY_MS = 60_000;

    private final JsonHelper jsonHelper;
    private final TemplateRenderer templateRenderer;

    public DelayNodeHandler(JsonHelper jsonHelper, TemplateRenderer templateRenderer) {
        this.jsonHelper = jsonHelper;
        this.templateRenderer = templateRenderer;
    }

    @Override
    public BlockType getSupportedType() {
        return BlockType.DELAY;
    }

    @Override
    public NodeResult handle(
            WorkflowBlockEntity block,
            ResolvedInput input,
            ExecutionContext context
    ) {
        Map<String, Object> config = jsonHelper.toMap(block.getConfig());

        long delayMs = resolveDelayMs(config, input, context);

        if (delayMs < 0) {
            throw new IllegalStateException("DELAY block delay must be >= 0");
        }

        if (delayMs > MAX_DELAY_MS) {
            throw new IllegalStateException(
                    "DELAY block exceeds max supported delay for sync worker: " + delayMs + " ms"
            );
        }

        try {
            Thread.sleep(delayMs);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("DELAY block interrupted", ex);
        }

        if (input.getValue() != null) {
            return NodeResult.of(input.getValue());
        }

        if (!input.getInputs().isEmpty()) {
            return NodeResult.of(input.getInputs());
        }

        return NodeResult.of(input.get("input"));
    }

    private long resolveDelayMs(
            Map<String, Object> config,
            ResolvedInput input,
            ExecutionContext context
    ) {
        if (config.containsKey("delayMs")) {
            return toLong(templateRenderer.renderValue(config.get("delayMs"), input, context));
        }

        if (config.containsKey("delaySeconds")) {
            return toLong(templateRenderer.renderValue(config.get("delaySeconds"), input, context)) * 1000;
        }

        if (config.containsKey("sourcePath")) {
            return toLong(resolvePath(input, String.valueOf(config.get("sourcePath"))));
        }

        Object variableName = config.get("variableName");
        if (variableName != null && !String.valueOf(variableName).isBlank()) {
            String renderedVariableName = templateRenderer.render(String.valueOf(variableName), input, context);
            Object variableValue = context.getVariable(renderedVariableName);
            return toLong(variableValue);
        }

        if (input.getValue() != null) {
            return toLong(input.getValue());
        }

        throw new IllegalStateException("DELAY block requires delayMs, delaySeconds, sourcePath, variableName, or input value");
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

    private long toLong(Object value) {
        if (value == null) {
            throw new IllegalStateException("Delay value is null");
        }

        if (value instanceof Number number) {
            return number.longValue();
        }

        try {
            return Long.parseLong(String.valueOf(value).trim());
        } catch (NumberFormatException ex) {
            throw new IllegalStateException("Delay value is not a number: " + value, ex);
        }
    }
}

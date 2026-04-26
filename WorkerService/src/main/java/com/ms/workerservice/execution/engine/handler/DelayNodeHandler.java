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
public class DelayNodeHandler implements NodeHandler {

    private static final long MAX_DELAY_MS = 60_000;

    private final JsonHelper jsonHelper;

    public DelayNodeHandler(JsonHelper jsonHelper) {
        this.jsonHelper = jsonHelper;
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

        return NodeResult.empty();
    }

    private long resolveDelayMs(
            Map<String, Object> config,
            ResolvedInput input,
            ExecutionContext context
    ) {
        if (config.containsKey("delayMs")) {
            return toLong(config.get("delayMs"));
        }

        if (config.containsKey("delaySeconds")) {
            return toLong(config.get("delaySeconds")) * 1000;
        }

        Object variableName = config.get("variableName");
        if (variableName != null && !String.valueOf(variableName).isBlank()) {
            Object variableValue = context.getVariable(String.valueOf(variableName));
            return toLong(variableValue);
        }

        if (input.getValue() != null) {
            return toLong(input.getValue());
        }

        throw new IllegalStateException("DELAY block requires delayMs, delaySeconds, variableName, or input value");
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

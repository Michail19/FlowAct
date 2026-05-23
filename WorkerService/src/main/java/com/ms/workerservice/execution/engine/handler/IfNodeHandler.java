package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.OptionalInt;

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
        String operator = String.valueOf(config.getOrDefault("operator", "truthy"));
        Object expectedValue = config.get("expectedValue");

        boolean result = evaluateCondition(conditionValue, operator, expectedValue);

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
            Object resolvedByPath = resolvePath(input, context, String.valueOf(inputKey));

            if (resolvedByPath != null) {
                return resolvedByPath;
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

    private Object resolvePath(
            ResolvedInput input,
            ExecutionContext context,
            String path
    ) {
        if (path == null || path.isBlank()) {
            return null;
        }

        String normalizedPath = path.trim();

        if ("input".equals(normalizedPath) || "executionInput".equals(normalizedPath)) {
            return context.getExecutionInput();
        }

        if ("value".equals(normalizedPath) || "condition".equals(normalizedPath)) {
            return input.getValue();
        }

        if ("last".equals(normalizedPath) || "output".equals(normalizedPath)) {
            return context.getLastSuccessfulOutput();
        }

        if ("inputs".equals(normalizedPath)) {
            return input.getInputs();
        }

        if ("outputs".equals(normalizedPath)) {
            return context.getBlockOutputsByStringId();
        }

        if ("variables".equals(normalizedPath)) {
            return context.getVariables();
        }

        if (normalizedPath.startsWith("input.")) {
            return readNestedValue(context.getExecutionInput(), normalizedPath.substring("input.".length()));
        }

        if (normalizedPath.startsWith("executionInput.")) {
            return readNestedValue(context.getExecutionInput(), normalizedPath.substring("executionInput.".length()));
        }

        if (normalizedPath.startsWith("value.")) {
            return readNestedValue(input.getValue(), normalizedPath.substring("value.".length()));
        }

        if (normalizedPath.startsWith("condition.")) {
            return readNestedValue(input.getValue(), normalizedPath.substring("condition.".length()));
        }

        if (normalizedPath.startsWith("last.")) {
            return readNestedValue(context.getLastSuccessfulOutput(), normalizedPath.substring("last.".length()));
        }

        if (normalizedPath.startsWith("output.")) {
            return readNestedValue(context.getLastSuccessfulOutput(), normalizedPath.substring("output.".length()));
        }

        if (normalizedPath.startsWith("inputs.")) {
            return readNestedValue(input.getInputs(), normalizedPath.substring("inputs.".length()));
        }

        if (normalizedPath.startsWith("outputs.")) {
            return readNestedValue(context.getBlockOutputsByStringId(), normalizedPath.substring("outputs.".length()));
        }

        if (normalizedPath.startsWith("variables.")) {
            return readNestedValue(context.getVariables(), normalizedPath.substring("variables.".length()));
        }

        if (input.get(normalizedPath) != null) {
            return input.get(normalizedPath);
        }

        if (input.getInputs().containsKey(normalizedPath)) {
            return input.getInputs().get(normalizedPath);
        }

        return readNestedValue(input.getValues(), normalizedPath);
    }

    @SuppressWarnings("unchecked")
    private Object readNestedValue(Object source, String path) {
        if (source == null || path == null || path.isBlank()) {
            return source;
        }

        Object currentValue = source;

        for (String segment : path.split("\\.")) {
            if (currentValue == null) {
                return null;
            }

            if (currentValue instanceof Map<?, ?> mapValue) {
                currentValue = ((Map<String, Object>) mapValue).get(segment);
                continue;
            }

            if (currentValue instanceof List<?> listValue) {
                int index;

                try {
                    index = Integer.parseInt(segment);
                } catch (NumberFormatException ex) {
                    return null;
                }

                if (index < 0 || index >= listValue.size()) {
                    return null;
                }

                currentValue = listValue.get(index);
                continue;
            }

            return null;
        }

        return currentValue;
    }

    private boolean evaluateCondition(Object actualValue, String operator, Object expectedValue) {
        return switch (normalizeOperator(operator)) {
            case "truthy" -> toBoolean(actualValue);
            case "exists" -> isPresent(actualValue);
            case "equals" -> compareAsNormalizedValues(actualValue, expectedValue) == 0;
            case "notEquals" -> compareAsNormalizedValues(actualValue, expectedValue) != 0;
            case "contains" -> contains(actualValue, expectedValue);
            case "greaterThan" -> compareAsNumbers(actualValue, expectedValue)
                    .stream()
                    .anyMatch(comparison -> comparison > 0);
            case "lessThan" -> compareAsNumbers(actualValue, expectedValue)
                    .stream()
                    .anyMatch(comparison -> comparison < 0);
            default -> toBoolean(actualValue);
        };
    }

    private String normalizeOperator(String operator) {
        if (operator == null || operator.isBlank()) {
            return "truthy";
        }

        return operator.trim();
    }

    private boolean isPresent(Object value) {
        if (value == null) {
            return false;
        }

        if (value instanceof String stringValue) {
            return !stringValue.isBlank();
        }

        return true;
    }

    private int compareAsNormalizedValues(Object actualValue, Object expectedValue) {
        BigDecimal actualNumber = toBigDecimalOrNull(actualValue);
        BigDecimal expectedNumber = toBigDecimalOrNull(expectedValue);

        if (actualNumber != null && expectedNumber != null) {
            return actualNumber.compareTo(expectedNumber);
        }

        Object normalizedActual = normalizeComparableValue(actualValue);
        Object normalizedExpected = normalizeComparableValue(expectedValue);

        if (Objects.equals(normalizedActual, normalizedExpected)) {
            return 0;
        }

        return 1;
    }

    private boolean contains(Object actualValue, Object expectedValue) {
        if (actualValue == null || expectedValue == null) {
            return false;
        }

        String actualString = String.valueOf(actualValue).toLowerCase();
        String expectedString = String.valueOf(expectedValue).toLowerCase();

        return actualString.contains(expectedString);
    }

    private OptionalInt compareAsNumbers(Object actualValue, Object expectedValue) {
        BigDecimal actualNumber = toBigDecimalOrNull(actualValue);
        BigDecimal expectedNumber = toBigDecimalOrNull(expectedValue);

        if (actualNumber == null || expectedNumber == null) {
            return OptionalInt.empty();
        }

        return OptionalInt.of(actualNumber.compareTo(expectedNumber));
    }

    private Object normalizeComparableValue(Object value) {
        if (value instanceof String stringValue) {
            String trimmedValue = stringValue.trim();

            if (trimmedValue.equalsIgnoreCase("true")) {
                return true;
            }

            if (trimmedValue.equalsIgnoreCase("false")) {
                return false;
            }

            return trimmedValue;
        }

        return value;
    }

    private BigDecimal toBigDecimalOrNull(Object value) {
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }

        if (value instanceof String stringValue) {
            String normalizedValue = stringValue.trim().replace(',', '.');

            if (normalizedValue.isBlank()) {
                return null;
            }

            try {
                return new BigDecimal(normalizedValue);
            } catch (NumberFormatException ignored) {
                return null;
            }
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

package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.stereotype.Component;

import java.lang.reflect.Array;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Component
public class FilterNodeHandler implements NodeHandler {

    private final JsonHelper jsonHelper;

    public FilterNodeHandler(JsonHelper jsonHelper) {
        this.jsonHelper = jsonHelper;
    }

    @Override
    public BlockType getSupportedType() {
        return BlockType.FILTER;
    }

    @Override
    public NodeResult handle(
            WorkflowBlockEntity block,
            ResolvedInput input,
            ExecutionContext context
    ) {
        Map<String, Object> config = jsonHelper.toMap(block.getConfig());

        String collectionPath = getString(config, "collectionPath", "input.items");
        String field = getString(config, "field", null);
        String operator = getString(config, "operator", "equals").trim().toLowerCase();
        Object expected = config.get("value");

        Object collectionValue = resolvePath(input, collectionPath);
        List<Object> items = toList(collectionValue);

        List<Object> filteredItems = items.stream()
                .filter(item -> matches(item, field, operator, expected))
                .toList();

        Map<String, Object> output = new LinkedHashMap<>();
        output.put("collectionPath", collectionPath);
        output.put("field", field);
        output.put("operator", operator);
        output.put("value", expected);
        output.put("count", filteredItems.size());
        output.put("items", filteredItems);

        return NodeResult.of(output);
    }

    private boolean matches(Object item, String field, String operator, Object expected) {
        Object actual = field == null || field.isBlank()
                ? item
                : readNestedValue(item, field);

        return switch (operator) {
            case "equals", "eq" -> Objects.equals(stringify(actual), stringify(expected));
            case "not_equals", "neq", "ne" -> !Objects.equals(stringify(actual), stringify(expected));
            case "contains" -> stringify(actual).contains(stringify(expected));
            case "not_contains" -> !stringify(actual).contains(stringify(expected));
            case "exists" -> actual != null;
            case "not_exists" -> actual == null;
            case "gt", "greater_than" -> compareNumbers(actual, expected) > 0;
            case "gte", "greater_or_equals" -> compareNumbers(actual, expected) >= 0;
            case "lt", "less_than" -> compareNumbers(actual, expected) < 0;
            case "lte", "less_or_equals" -> compareNumbers(actual, expected) <= 0;
            default -> throw new IllegalStateException("Unsupported FILTER operator: " + operator);
        };
    }

    private Object resolvePath(ResolvedInput input, String path) {
        if (path == null || path.isBlank()) {
            return input.getValue();
        }

        String normalizedPath = path.trim();

        if ("input".equals(normalizedPath) || "value".equals(normalizedPath)) {
            return input.getValue();
        }

        if (normalizedPath.startsWith("input.")) {
            return readNestedValue(input.getValue(), normalizedPath.substring("input.".length()));
        }

        if (normalizedPath.startsWith("value.")) {
            return readNestedValue(input.getValue(), normalizedPath.substring("value.".length()));
        }

        if (normalizedPath.startsWith("variables.")) {
            return readNestedValue(input.getVariables(), normalizedPath.substring("variables.".length()));
        }

        if (normalizedPath.startsWith("inputs.")) {
            return readNestedValue(input.getInputs(), normalizedPath.substring("inputs.".length()));
        }

        return readNestedValue(input.getValues(), normalizedPath);
    }

    @SuppressWarnings("unchecked")
    private Object readNestedValue(Object source, String path) {
        if (source == null || path == null || path.isBlank()) {
            return source;
        }

        Object current = source;

        for (String segment : path.split("\\.")) {
            if (current == null) {
                return null;
            }

            if (current instanceof Map<?, ?> map) {
                current = ((Map<String, Object>) map).get(segment);
                continue;
            }

            if (current instanceof List<?> list && isInteger(segment)) {
                int index = Integer.parseInt(segment);

                if (index < 0 || index >= list.size()) {
                    return null;
                }

                current = list.get(index);
                continue;
            }

            return null;
        }

        return current;
    }

    private List<Object> toList(Object value) {
        if (value == null) {
            return List.of();
        }

        if (value instanceof List<?> list) {
            return new ArrayList<>(list);
        }

        if (value instanceof Collection<?> collection) {
            return new ArrayList<>(collection);
        }

        if (value.getClass().isArray()) {
            int length = Array.getLength(value);
            List<Object> result = new ArrayList<>(length);

            for (int index = 0; index < length; index += 1) {
                result.add(Array.get(value, index));
            }

            return result;
        }

        return List.of(value);
    }

    private String getString(Map<String, Object> config, String key, String fallback) {
        Object value = config.get(key);

        if (value == null) {
            return fallback;
        }

        return String.valueOf(value);
    }

    private String stringify(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private int compareNumbers(Object actual, Object expected) {
        return Double.compare(toDouble(actual), toDouble(expected));
    }

    private double toDouble(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }

        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException ex) {
            throw new IllegalStateException("FILTER comparison value is not a number: " + value, ex);
        }
    }

    private boolean isInteger(String value) {
        try {
            Integer.parseInt(value);
            return true;
        } catch (NumberFormatException ex) {
            return false;
        }
    }
}

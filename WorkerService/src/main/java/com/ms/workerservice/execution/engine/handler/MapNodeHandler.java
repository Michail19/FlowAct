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

@Component
public class MapNodeHandler implements NodeHandler {

    private final JsonHelper jsonHelper;

    public MapNodeHandler(JsonHelper jsonHelper) {
        this.jsonHelper = jsonHelper;
    }

    @Override
    public BlockType getSupportedType() {
        return BlockType.MAP;
    }

    @Override
    public NodeResult handle(
            WorkflowBlockEntity block,
            ResolvedInput input,
            ExecutionContext context
    ) {
        Map<String, Object> config = jsonHelper.toMap(block.getConfig());

        String collectionPath = String.valueOf(
                config.getOrDefault("collectionPath", "input.items")
        );

        String itemName = String.valueOf(
                config.getOrDefault("itemName", "item")
        );

        String mode = String.valueOf(
                config.getOrDefault("mode", "map")
        );

        Object collectionValue = resolvePath(input, collectionPath);
        List<Object> items = toList(collectionValue);

        List<Object> results = new ArrayList<>();
        List<Map<String, Object>> iterations = new ArrayList<>();

        for (int index = 0; index < items.size(); index += 1) {
            Object item = items.get(index);

            Map<String, Object> iteration = new LinkedHashMap<>();
            iteration.put("index", index);
            iteration.put(itemName, item);

            iterations.add(iteration);
            results.add(item);
        }

        Map<String, Object> output = new LinkedHashMap<>();
        output.put("collectionPath", collectionPath);
        output.put("itemName", itemName);
        output.put("mode", mode);
        output.put("count", items.size());
        output.put("items", items);
        output.put("iterations", iterations);
        output.put("results", results);

        return NodeResult.of(output);
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
            return readNestedValue(
                    input.getVariables(),
                    normalizedPath.substring("variables.".length())
            );
        }

        if (normalizedPath.startsWith("inputs.")) {
            return readNestedValue(
                    input.getInputs(),
                    normalizedPath.substring("inputs.".length())
            );
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

    private boolean isInteger(String value) {
        try {
            Integer.parseInt(value);
            return true;
        } catch (NumberFormatException ex) {
            return false;
        }
    }
}

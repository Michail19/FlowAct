package com.ms.workerservice.execution.engine;

import com.ms.workerservice.common.util.JsonHelper;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class TemplateRenderer {

    private static final Pattern PLACEHOLDER_PATTERN =
            Pattern.compile("\\{\\{\\s*([^}]+?)\\s*}}");

    private final JsonHelper jsonHelper;

    public TemplateRenderer(JsonHelper jsonHelper) {
        this.jsonHelper = jsonHelper;
    }

    public boolean containsPlaceholders(String value) {
        return value != null && PLACEHOLDER_PATTERN.matcher(value).find();
    }

    public String render(
            String template,
            ResolvedInput input,
            ExecutionContext context
    ) {
        if (template == null || template.isBlank()) {
            return template;
        }

        Matcher matcher = PLACEHOLDER_PATTERN.matcher(template);
        StringBuffer result = new StringBuffer();

        while (matcher.find()) {
            String expression = matcher.group(1).trim();
            Object value = resolveExpression(expression, input, context);

            String replacement = stringifyValue(value);

            matcher.appendReplacement(
                    result,
                    Matcher.quoteReplacement(replacement)
            );
        }

        matcher.appendTail(result);

        return result.toString();
    }

    public Object renderValue(
            Object value,
            ResolvedInput input,
            ExecutionContext context
    ) {
        if (value instanceof String stringValue) {
            return render(stringValue, input, context);
        }

        if (value instanceof Map<?, ?> mapValue) {
            Map<String, Object> renderedMap = new LinkedHashMap<>();

            for (Map.Entry<?, ?> entry : mapValue.entrySet()) {
                renderedMap.put(
                        String.valueOf(entry.getKey()),
                        renderValue(entry.getValue(), input, context)
                );
            }

            return renderedMap;
        }

        if (value instanceof List<?> listValue) {
            List<Object> renderedList = new ArrayList<>();

            for (Object item : listValue) {
                renderedList.add(renderValue(item, input, context));
            }

            return renderedList;
        }

        return value;
    }

    public Object getMainInput(ResolvedInput input) {
        if (input.getValue() != null) {
            return input.getValue();
        }

        if (input.get("input") != null) {
            return input.get("input");
        }

        if (!input.getInputs().isEmpty()) {
            return input.getInputs();
        }

        return null;
    }

    private Object resolveExpression(
            String expression,
            ResolvedInput input,
            ExecutionContext context
    ) {
        Map<String, Object> root = new LinkedHashMap<>();

        root.put("input", input.get("input"));
        root.put("executionInput", input.get("executionInput"));
        root.put("value", input.getValue());
        root.put("inputs", input.getInputs());
        root.put("output", input.get("output"));
        root.put("last", input.get("last"));
        root.put("outputs", input.get("outputs"));
        root.put("variables", context.getVariables());

        return getByPath(root, expression);
    }

    private Object getByPath(Object source, String path) {
        String[] parts = path.split("\\.");
        Object currentValue = source;

        for (String part : parts) {
            if (currentValue == null) {
                return null;
            }

            if (currentValue instanceof Map<?, ?> mapValue) {
                currentValue = mapValue.get(part);
                continue;
            }

            if (currentValue instanceof List<?> listValue) {
                int index;

                try {
                    index = Integer.parseInt(part);
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

    private String stringifyValue(Object value) {
        if (value == null) {
            return "";
        }

        if (value instanceof String stringValue) {
            return stringValue;
        }

        if (
                value instanceof Number ||
                        value instanceof Boolean
        ) {
            return String.valueOf(value);
        }

        return jsonHelper.toJson(value);
    }
}

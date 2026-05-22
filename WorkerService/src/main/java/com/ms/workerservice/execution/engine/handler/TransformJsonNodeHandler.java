package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.execution.engine.TemplateRenderer;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class TransformJsonNodeHandler implements NodeHandler {

    private final JsonHelper jsonHelper;
    private final TemplateRenderer templateRenderer;

    public TransformJsonNodeHandler(JsonHelper jsonHelper, TemplateRenderer templateRenderer) {
        this.jsonHelper = jsonHelper;
        this.templateRenderer = templateRenderer;
    }

    @Override
    public BlockType getSupportedType() {
        return BlockType.TRANSFORM_JSON;
    }

    @Override
    public NodeResult handle(
            WorkflowBlockEntity block,
            ResolvedInput input,
            ExecutionContext context
    ) {
        Map<String, Object> config = jsonHelper.toMap(block.getConfig());

        if (hasLegacyTransformConfig(config)) {
            return NodeResult.of(applyLegacyTransform(config, input, context));
        }

        String actionType = templateRenderer.render(getString(config, "actionType", "transform"), input, context);
        String parameters = templateRenderer.render(getString(config, "parameters", ""), input, context).trim();

        if (parameters.isBlank()) {
            return NodeResult.of(getMapLikeInput(input));
        }

        Object parsedParameters = parseParameters(parameters);

        if ("custom".equalsIgnoreCase(actionType)
                || "transform".equalsIgnoreCase(actionType)
                || "format".equalsIgnoreCase(actionType)) {
            return NodeResult.of(parsedParameters);
        }

        Map<String, Object> output = new LinkedHashMap<>();
        output.put("actionType", actionType);
        output.put("input", input.getValues());
        output.put("parameters", parsedParameters);

        return NodeResult.of(output);
    }

    private boolean hasLegacyTransformConfig(Map<String, Object> config) {
        return config.containsKey("add")
                || config.containsKey("replace")
                || config.containsKey("remove");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> applyLegacyTransform(
            Map<String, Object> config,
            ResolvedInput input,
            ExecutionContext context
    ) {
        Map<String, Object> output = getMapLikeInput(input);

        Object removeValue = templateRenderer.renderValue(config.get("remove"), input, context);

        if (removeValue instanceof List<?> removeList) {
            for (Object field : removeList) {
                if (field != null) {
                    output.remove(String.valueOf(field));
                }
            }
        }

        Object replaceValue = templateRenderer.renderValue(config.get("replace"), input, context);

        if (replaceValue instanceof Map<?, ?> replaceMap) {
            for (Map.Entry<?, ?> entry : replaceMap.entrySet()) {
                output.put(String.valueOf(entry.getKey()), entry.getValue());
            }
        }

        Object addValue = templateRenderer.renderValue(config.get("add"), input, context);

        if (addValue instanceof Map<?, ?> addMap) {
            for (Map.Entry<?, ?> entry : addMap.entrySet()) {
                output.put(String.valueOf(entry.getKey()), entry.getValue());
            }
        }

        return output;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getMapLikeInput(ResolvedInput input) {
        Object value = input.getValue();

        if (value instanceof Map<?, ?> map) {
            return new LinkedHashMap<>((Map<String, Object>) map);
        }

        if (value != null) {
            throw new IllegalStateException("TRANSFORM_JSON input must be map-like");
        }

        Map<String, Object> inputs = input.getInputs();

        if (!inputs.isEmpty()) {
            return new LinkedHashMap<>(inputs);
        }

        return new LinkedHashMap<>(input.getValues());
    }

    private Object parseParameters(String parameters) {
        if (!jsonHelper.looksLikeJson(parameters)) {
            return parameters;
        }

        return jsonHelper.toObject(parameters);
    }

    private String getString(
            Map<String, Object> config,
            String key,
            String fallback
    ) {
        Object value = config.get(key);

        if (value == null) {
            return fallback;
        }

        return String.valueOf(value);
    }
}

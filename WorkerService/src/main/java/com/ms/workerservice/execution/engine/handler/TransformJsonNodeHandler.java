package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class TransformJsonNodeHandler implements NodeHandler {

    private final JsonHelper jsonHelper;

    public TransformJsonNodeHandler(JsonHelper jsonHelper) {
        this.jsonHelper = jsonHelper;
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

        String actionType = String.valueOf(config.getOrDefault("actionType", "transform"));
        String parameters = String.valueOf(config.getOrDefault("parameters", "")).trim();

        if (parameters.isBlank()) {
            return NodeResult.of(input.getValues());
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

    private Object parseParameters(String parameters) {
        if (!jsonHelper.looksLikeJson(parameters)) {
            return parameters;
        }

        return jsonHelper.toObject(parameters);
    }
}

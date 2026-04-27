package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
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

        Object rawInput = input.getValue();
        if (rawInput == null) {
            rawInput = input.getInputs();
        }

        if (!(rawInput instanceof Map<?, ?> rawMap)) {
            throw new IllegalStateException("TRANSFORM_JSON block requires map-like input");
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> source = new LinkedHashMap<>((Map<String, Object>) rawMap);

        applyRemove(source, config);
        applyReplace(source, config);
        applyAdd(source, config);

        return NodeResult.of(source);
    }

    private void applyRemove(Map<String, Object> source, Map<String, Object> config) {
        Object removeRaw = config.get("remove");

        if (!(removeRaw instanceof List<?> removeList)) {
            return;
        }

        for (Object fieldObj : removeList) {
            String field = String.valueOf(fieldObj);
            source.remove(field);
        }
    }

    private void applyReplace(Map<String, Object> source, Map<String, Object> config) {
        Object replaceRaw = config.get("replace");

        if (!(replaceRaw instanceof Map<?, ?> replaceMap)) {
            return;
        }

        for (Map.Entry<?, ?> entry : replaceMap.entrySet()) {
            String field = String.valueOf(entry.getKey());
            Object value = entry.getValue();

            if (source.containsKey(field)) {
                source.put(field, value);
            }
        }
    }

    private void applyAdd(Map<String, Object> source, Map<String, Object> config) {
        Object addRaw = config.get("add");

        if (!(addRaw instanceof Map<?, ?> addMap)) {
            return;
        }

        for (Map.Entry<?, ?> entry : addMap.entrySet()) {
            String field = String.valueOf(entry.getKey());
            Object value = entry.getValue();
            source.put(field, value);
        }
    }
}

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

        Object rawInput = input.getValue();
        if (rawInput == null) {
            rawInput = input.getInputs();
        }

        if (!(rawInput instanceof Map<?, ?> rawMap)) {
            throw new IllegalStateException("MAP block requires map-like input");
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> source = (Map<String, Object>) rawMap;

        String mode = String.valueOf(config.getOrDefault("mode", "pick")).trim().toLowerCase();

        return switch (mode) {
            case "pick" -> NodeResult.of(applyPick(source, config));
            case "rename" -> NodeResult.of(applyRename(source, config));
            default -> throw new IllegalStateException("Unsupported MAP mode: " + mode);
        };
    }

    private Map<String, Object> applyPick(Map<String, Object> source, Map<String, Object> config) {
        Object fieldsRaw = config.get("fields");

        if (!(fieldsRaw instanceof List<?> fields)) {
            throw new IllegalStateException("MAP mode 'pick' requires config.fields");
        }

        Map<String, Object> result = new LinkedHashMap<>();

        for (Object fieldObj : fields) {
            String field = String.valueOf(fieldObj);
            if (source.containsKey(field)) {
                result.put(field, source.get(field));
            }
        }

        return result;
    }

    private Map<String, Object> applyRename(Map<String, Object> source, Map<String, Object> config) {
        Object mappingRaw = config.get("mapping");

        if (!(mappingRaw instanceof Map<?, ?> mapping)) {
            throw new IllegalStateException("MAP mode 'rename' requires config.mapping");
        }

        Map<String, Object> result = new LinkedHashMap<>();

        for (Map.Entry<?, ?> entry : mapping.entrySet()) {
            String from = String.valueOf(entry.getKey());
            String to = String.valueOf(entry.getValue());

            if (source.containsKey(from)) {
                result.put(to, source.get(from));
            }
        }

        return result;
    }
}

package com.ms.workerservice.execution.engine;

import lombok.Getter;
import lombok.Setter;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class ExecutionContext {

    @Getter
    private final UUID executionId;
    @Getter
    private final UUID workflowId;
    @Getter
    private final Object executionInput;

    private final Map<UUID, Object> blockOutputs = new HashMap<>();
    private final Map<String, Object> variables = new HashMap<>();

    @Setter
    @Getter
    private Object lastSuccessfulOutput;

    public ExecutionContext(UUID executionId, UUID workflowId) {
        this(executionId, workflowId, null);
    }

    public ExecutionContext(UUID executionId, UUID workflowId, Object executionInput) {
        this.executionId = executionId;
        this.workflowId = workflowId;
        this.executionInput = executionInput;
    }

    public void putBlockOutput(UUID blockId, Object output) {
        blockOutputs.put(blockId, output);
        lastSuccessfulOutput = output;
    }

    public Object getBlockOutput(UUID blockId) {
        return blockOutputs.get(blockId);
    }

    public Map<UUID, Object> getBlockOutputs() {
        return Map.copyOf(blockOutputs);
    }

    public Map<String, Object> getBlockOutputsByStringId() {
        Map<String, Object> result = new HashMap<>();

        for (Map.Entry<UUID, Object> entry : blockOutputs.entrySet()) {
            result.put(entry.getKey().toString(), entry.getValue());
        }

        return Map.copyOf(result);
    }

    public void putVariable(String key, Object value) {
        variables.put(key, value);
    }

    public Object getVariable(String key) {
        return variables.get(key);
    }

    public Map<String, Object> getVariables() {
        return Map.copyOf(variables);
    }
}

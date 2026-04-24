package com.ms.workerservice.execution.engine;

import lombok.Getter;

import java.util.Map;

@Getter
public class ResolvedInput {

    private final Map<String, Object> values;

    public ResolvedInput(Map<String, Object> values) {
        this.values = values;
    }

    public Object get(String key) {
        return values.get(key);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getMap(String key) {
        Object value = values.get(key);
        if (value instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return Map.of();
    }

    public Object getValue() {
        return values.get("value");
    }

    public Map<String, Object> getVariables() {
        return getMap("variables");
    }

    public Map<String, Object> getInputs() {
        return getMap("inputs");
    }

    public static ResolvedInput empty() {
        return new ResolvedInput(Map.of());
    }
}

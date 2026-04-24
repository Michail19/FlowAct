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

    public static ResolvedInput empty() {
        return new ResolvedInput(Map.of());
    }
}

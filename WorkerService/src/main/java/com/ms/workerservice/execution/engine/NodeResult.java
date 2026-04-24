package com.ms.workerservice.execution.engine;

public class NodeResult {

    private final Object output;

    public NodeResult(Object output) {
        this.output = output;
    }

    public Object getOutput() {
        return output;
    }

    public static NodeResult empty() {
        return new NodeResult(null);
    }

    public static NodeResult of(Object output) {
        return new NodeResult(output);
    }
}

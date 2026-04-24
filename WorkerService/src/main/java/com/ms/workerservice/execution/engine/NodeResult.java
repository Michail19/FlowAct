package com.ms.workerservice.execution.engine;

public class NodeResult {

    private final Object output;
    private final String selectedBranch;

    public NodeResult(Object output, String selectedBranch) {
        this.output = output;
        this.selectedBranch = selectedBranch;
    }

    public Object getOutput() {
        return output;
    }

    public String getSelectedBranch() {
        return selectedBranch;
    }

    public static NodeResult empty() {
        return new NodeResult(null, null);
    }

    public static NodeResult of(Object output) {
        return new NodeResult(output, null);
    }

    public static NodeResult branch(String selectedBranch) {
        return new NodeResult(null, selectedBranch);
    }

    public static NodeResult of(Object output, String selectedBranch) {
        return new NodeResult(output, selectedBranch);
    }
}

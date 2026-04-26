package com.ms.workerservice.execution.engine;

import lombok.Getter;

@Getter
public class NodeResult {

    private final Object output;
    private final String selectedBranch;
    private final NodeAction action;

    public NodeResult(Object output, String selectedBranch, NodeAction action) {
        this.output = output;
        this.selectedBranch = selectedBranch;
        this.action = action;
    }

    public static NodeResult empty() {
        return new NodeResult(null, null, NodeAction.CONTINUE);
    }

    public static NodeResult of(Object output) {
        return new NodeResult(output, null, NodeAction.CONTINUE);
    }

    public static NodeResult of(Object output, String selectedBranch) {
        return new NodeResult(output, selectedBranch, NodeAction.CONTINUE);
    }

    public static NodeResult waitResult(Object output) {
        return new NodeResult(output, null, NodeAction.WAIT);
    }

    public static NodeResult complete(Object output) {
        return new NodeResult(output, null, NodeAction.COMPLETE);
    }
}

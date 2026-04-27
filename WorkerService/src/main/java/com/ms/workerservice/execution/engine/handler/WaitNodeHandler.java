package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.execution.engine.WaitState;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class WaitNodeHandler implements NodeHandler {

    private final JsonHelper jsonHelper;

    public WaitNodeHandler(JsonHelper jsonHelper) {
        this.jsonHelper = jsonHelper;
    }

    @Override
    public BlockType getSupportedType() {
        return BlockType.WAIT;
    }

    @Override
    public NodeResult handle(
            WorkflowBlockEntity block,
            ResolvedInput input,
            ExecutionContext context
    ) {
        Map<String, Object> config = jsonHelper.toMap(block.getConfig());

        Object inputValue = null;
        if (input.getValue() != null) {
            inputValue = input.getValue();
        } else if (!input.getInputs().isEmpty()) {
            inputValue = input.getInputs();
        }

        WaitState waitState = WaitState.builder()
                .waitType(String.valueOf(config.getOrDefault("waitType", "manual")))
                .resumeKey(String.valueOf(config.getOrDefault("resumeKey", block.getId().toString())))
                .waitingBlockId(block.getId().toString())
                .input(inputValue)
                .build();

        return NodeResult.waitResult(waitState);
    }
}

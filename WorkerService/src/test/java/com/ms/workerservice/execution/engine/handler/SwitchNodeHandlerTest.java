package com.ms.workerservice.execution.engine.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class SwitchNodeHandlerTest {

    private SwitchNodeHandler switchNodeHandler;

    @BeforeEach
    void setUp() {
        JsonHelper jsonHelper = new JsonHelper(new ObjectMapper());
        switchNodeHandler = new SwitchNodeHandler(jsonHelper);
    }

    @Test
    void shouldSelectBranchFromVariable() {
        WorkflowBlockEntity block = block("""
                {"variableName":"decision"}
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());
        context.putVariable("decision", "approved");

        ResolvedInput input = ResolvedInput.empty();

        NodeResult result = switchNodeHandler.handle(block, input, context);

        assertEquals("approved", result.getSelectedBranch());
    }

    @Test
    void shouldSelectBranchFromInputKey() {
        WorkflowBlockEntity block = block("""
                {"inputKey":"value"}
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());

        ResolvedInput input = new ResolvedInput(Map.of(
                "value", "rejected"
        ));

        NodeResult result = switchNodeHandler.handle(block, input, context);

        assertEquals("rejected", result.getSelectedBranch());
    }

    @Test
    void shouldFallbackToFirstInputValue() {
        WorkflowBlockEntity block = block("""
                {}
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());

        ResolvedInput input = new ResolvedInput(Map.of(
                "inputs", Map.of("source-1", "pending")
        ));

        NodeResult result = switchNodeHandler.handle(block, input, context);

        assertEquals("pending", result.getSelectedBranch());
    }

    @Test
    void shouldReturnDefaultWhenValueIsNull() {
        WorkflowBlockEntity block = block("""
                {}
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());
        ResolvedInput input = ResolvedInput.empty();

        NodeResult result = switchNodeHandler.handle(block, input, context);

        assertEquals("default", result.getSelectedBranch());
    }

    @Test
    void shouldConvertNumberToStringBranch() {
        WorkflowBlockEntity block = block("""
                {"inputKey":"value"}
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());

        ResolvedInput input = new ResolvedInput(Map.of(
                "value", 404
        ));

        NodeResult result = switchNodeHandler.handle(block, input, context);

        assertEquals("404", result.getSelectedBranch());
    }

    private WorkflowBlockEntity block(String configJson) {
        return WorkflowBlockEntity.builder()
                .id(UUID.randomUUID())
                .type(BlockType.SWITCH)
                .name("Switch")
                .position("{}")
                .config(configJson)
                .build();
    }
}

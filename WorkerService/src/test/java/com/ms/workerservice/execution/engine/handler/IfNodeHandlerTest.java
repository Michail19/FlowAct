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

class IfNodeHandlerTest {

    private IfNodeHandler ifNodeHandler;

    @BeforeEach
    void setUp() {
        JsonHelper jsonHelper = new JsonHelper(new ObjectMapper());
        ifNodeHandler = new IfNodeHandler(jsonHelper);
    }

    @Test
    void shouldReturnTrueBranchWhenVariableIsTrue() {
        WorkflowBlockEntity block = block("""
                {"variableName":"isApproved"}
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());
        context.putVariable("isApproved", true);

        ResolvedInput input = ResolvedInput.empty();

        NodeResult result = ifNodeHandler.handle(block, input, context);

        assertEquals("true", result.getSelectedBranch());
        assertInstanceOf(Map.class, result.getOutput());

        @SuppressWarnings("unchecked")
        Map<String, Object> output = (Map<String, Object>) result.getOutput();
        assertEquals(true, output.get("result"));
    }

    @Test
    void shouldReturnFalseBranchWhenVariableIsFalse() {
        WorkflowBlockEntity block = block("""
                {"variableName":"isApproved"}
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());
        context.putVariable("isApproved", false);

        ResolvedInput input = ResolvedInput.empty();

        NodeResult result = ifNodeHandler.handle(block, input, context);

        assertEquals("false", result.getSelectedBranch());
    }

    @Test
    void shouldUseInputKeyWhenProvided() {
        WorkflowBlockEntity block = block("""
                {"inputKey":"value"}
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());

        ResolvedInput input = new ResolvedInput(Map.of(
                "value", 1
        ));

        NodeResult result = ifNodeHandler.handle(block, input, context);

        assertEquals("true", result.getSelectedBranch());
    }

    @Test
    void shouldFallbackToSingleInputValue() {
        WorkflowBlockEntity block = block("""
                {}
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());

        ResolvedInput input = new ResolvedInput(Map.of(
                "value", "yes",
                "inputs", Map.of("source", "yes")
        ));

        NodeResult result = ifNodeHandler.handle(block, input, context);

        assertEquals("true", result.getSelectedBranch());
    }

    @Test
    void shouldTreatNullAsFalse() {
        WorkflowBlockEntity block = block("""
                {}
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());
        ResolvedInput input = ResolvedInput.empty();

        NodeResult result = ifNodeHandler.handle(block, input, context);

        assertEquals("false", result.getSelectedBranch());
    }

    private WorkflowBlockEntity block(String configJson) {
        return WorkflowBlockEntity.builder()
                .id(UUID.randomUUID())
                .type(BlockType.IF)
                .name("If")
                .position("{}")
                .config(configJson)
                .build();
    }
}

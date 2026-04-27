package com.ms.workerservice.execution.engine.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeAction;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class DelayNodeHandlerTest {

    private DelayNodeHandler delayNodeHandler;

    @BeforeEach
    void setUp() {
        JsonHelper jsonHelper = new JsonHelper(new ObjectMapper());
        delayNodeHandler = new DelayNodeHandler(jsonHelper);
    }

    @Test
    void shouldReturnInputValueAfterShortDelay() {
        WorkflowBlockEntity block = block("""
                {
                  "delayMs": 1
                }
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());
        ResolvedInput input = new ResolvedInput(Map.of(
                "value", Map.of("status", "ok")
        ));

        NodeResult result = delayNodeHandler.handle(block, input, context);

        assertEquals(NodeAction.CONTINUE, result.getAction());
        assertEquals(Map.of("status", "ok"), result.getOutput());
    }

    @Test
    void shouldReturnInputsWhenValueIsMissing() {
        WorkflowBlockEntity block = block("""
                {
                  "delayMs": 1
                }
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());
        ResolvedInput input = new ResolvedInput(Map.of(
                "inputs", Map.of(
                        "source-1", Map.of("approved", true)
                )
        ));

        NodeResult result = delayNodeHandler.handle(block, input, context);

        assertEquals(NodeAction.CONTINUE, result.getAction());
        assertEquals(Map.of("source-1", Map.of("approved", true)), result.getOutput());
    }

    @Test
    void shouldUseDelaySecondsFromConfig() {
        WorkflowBlockEntity block = block("""
                {
                  "delaySeconds": 0
                }
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());
        ResolvedInput input = ResolvedInput.empty();

        NodeResult result = delayNodeHandler.handle(block, input, context);

        assertEquals(NodeAction.CONTINUE, result.getAction());
    }

    @Test
    void shouldFailWhenDelayIsNegative() {
        WorkflowBlockEntity block = block("""
                {
                  "delayMs": -1
                }
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());
        ResolvedInput input = ResolvedInput.empty();

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> delayNodeHandler.handle(block, input, context)
        );

        assertTrue(ex.getMessage().contains(">= 0"));
    }

    @Test
    void shouldFailWhenDelayExceedsMaxSupportedValue() {
        WorkflowBlockEntity block = block("""
                {
                  "delayMs": 70000
                }
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());
        ResolvedInput input = ResolvedInput.empty();

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> delayNodeHandler.handle(block, input, context)
        );

        assertTrue(ex.getMessage().contains("max supported delay"));
    }

    @Test
    void shouldUseVariableValueWhenConfigured() {
        WorkflowBlockEntity block = block("""
                {
                  "variableName": "delayMs"
                }
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());
        context.putVariable("delayMs", 1);

        ResolvedInput input = new ResolvedInput(Map.of(
                "value", "payload"
        ));

        NodeResult result = delayNodeHandler.handle(block, input, context);

        assertEquals("payload", result.getOutput());
    }

    private WorkflowBlockEntity block(String configJson) {
        return WorkflowBlockEntity.builder()
                .id(UUID.randomUUID())
                .type(BlockType.DELAY)
                .name("Delay")
                .position("{}")
                .config(configJson)
                .build();
    }
}

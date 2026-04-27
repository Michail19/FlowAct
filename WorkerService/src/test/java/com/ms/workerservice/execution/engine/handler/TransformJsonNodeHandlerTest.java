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

class TransformJsonNodeHandlerTest {

    private TransformJsonNodeHandler transformJsonNodeHandler;

    @BeforeEach
    void setUp() {
        JsonHelper jsonHelper = new JsonHelper(new ObjectMapper());
        transformJsonNodeHandler = new TransformJsonNodeHandler(jsonHelper);
    }

    @Test
    void shouldAddReplaceAndRemoveFields() {
        WorkflowBlockEntity block = block("""
                {
                  "remove": ["password"],
                  "replace": {
                    "status": "processed"
                  },
                  "add": {
                    "source": "worker-service"
                  }
                }
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());
        ResolvedInput input = new ResolvedInput(Map.of(
                "value", Map.of(
                        "name", "Mikhail",
                        "status", "draft",
                        "password", "123456"
                )
        ));

        NodeResult result = transformJsonNodeHandler.handle(block, input, context);

        @SuppressWarnings("unchecked")
        Map<String, Object> output = (Map<String, Object>) result.getOutput();

        assertEquals("Mikhail", output.get("name"));
        assertEquals("processed", output.get("status"));
        assertEquals("worker-service", output.get("source"));
        assertFalse(output.containsKey("password"));
    }

    @Test
    void shouldWorkWhenOnlyAddIsConfigured() {
        WorkflowBlockEntity block = block("""
                {
                  "add": {
                    "status": "new"
                  }
                }
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());
        ResolvedInput input = new ResolvedInput(Map.of(
                "value", Map.of(
                        "name", "Mikhail"
                )
        ));

        NodeResult result = transformJsonNodeHandler.handle(block, input, context);

        @SuppressWarnings("unchecked")
        Map<String, Object> output = (Map<String, Object>) result.getOutput();

        assertEquals("Mikhail", output.get("name"));
        assertEquals("new", output.get("status"));
    }

    @Test
    void shouldUseInputsWhenValueIsMissing() {
        WorkflowBlockEntity block = block("""
                {
                  "add": {
                    "merged": true
                  }
                }
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());
        ResolvedInput input = new ResolvedInput(Map.of(
                "inputs", Map.of(
                        "source-1", Map.of("ok", true)
                )
        ));

        NodeResult result = transformJsonNodeHandler.handle(block, input, context);

        @SuppressWarnings("unchecked")
        Map<String, Object> output = (Map<String, Object>) result.getOutput();

        assertEquals(Map.of("ok", true), output.get("source-1"));
        assertEquals(true, output.get("merged"));
    }

    @Test
    void shouldFailWhenInputIsNotMapLike() {
        WorkflowBlockEntity block = block("""
                {
                  "add": {
                    "status": "x"
                  }
                }
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());
        ResolvedInput input = new ResolvedInput(Map.of(
                "value", "not-a-map"
        ));

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> transformJsonNodeHandler.handle(block, input, context)
        );

        assertTrue(ex.getMessage().contains("map-like"));
    }

    private WorkflowBlockEntity block(String configJson) {
        return WorkflowBlockEntity.builder()
                .id(UUID.randomUUID())
                .type(BlockType.TRANSFORM_JSON)
                .name("TransformJson")
                .position("{}")
                .config(configJson)
                .build();
    }
}

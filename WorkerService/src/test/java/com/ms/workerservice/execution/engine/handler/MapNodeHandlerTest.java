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

class MapNodeHandlerTest {

    private MapNodeHandler mapNodeHandler;

    @BeforeEach
    void setUp() {
        JsonHelper jsonHelper = new JsonHelper(new ObjectMapper());
        mapNodeHandler = new MapNodeHandler(jsonHelper);
    }

    @Test
    void shouldPickConfiguredFields() {
        WorkflowBlockEntity block = block("""
                {
                  "mode": "pick",
                  "fields": ["name", "email"]
                }
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());
        ResolvedInput input = new ResolvedInput(Map.of(
                "value", Map.of(
                        "name", "Mikhail",
                        "email", "test@example.com",
                        "age", 22
                )
        ));

        NodeResult result = mapNodeHandler.handle(block, input, context);

        @SuppressWarnings("unchecked")
        Map<String, Object> output = (Map<String, Object>) result.getOutput();

        assertEquals(2, output.size());
        assertEquals("Mikhail", output.get("name"));
        assertEquals("test@example.com", output.get("email"));
        assertFalse(output.containsKey("age"));
    }

    @Test
    void shouldRenameConfiguredFields() {
        WorkflowBlockEntity block = block("""
                {
                  "mode": "rename",
                  "mapping": {
                    "name": "userName",
                    "email": "userEmail"
                  }
                }
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());
        ResolvedInput input = new ResolvedInput(Map.of(
                "value", Map.of(
                        "name", "Mikhail",
                        "email", "test@example.com"
                )
        ));

        NodeResult result = mapNodeHandler.handle(block, input, context);

        @SuppressWarnings("unchecked")
        Map<String, Object> output = (Map<String, Object>) result.getOutput();

        assertEquals("Mikhail", output.get("userName"));
        assertEquals("test@example.com", output.get("userEmail"));
        assertFalse(output.containsKey("name"));
        assertFalse(output.containsKey("email"));
    }

    @Test
    void shouldUseInputsWhenValueIsMissing() {
        WorkflowBlockEntity block = block("""
                {
                  "mode": "pick",
                  "fields": ["source-1"]
                }
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());
        ResolvedInput input = new ResolvedInput(Map.of(
                "inputs", Map.of(
                        "source-1", Map.of("ok", true),
                        "source-2", Map.of("ok", false)
                )
        ));

        NodeResult result = mapNodeHandler.handle(block, input, context);

        @SuppressWarnings("unchecked")
        Map<String, Object> output = (Map<String, Object>) result.getOutput();

        assertEquals(1, output.size());
        assertEquals(Map.of("ok", true), output.get("source-1"));
    }

    @Test
    void shouldFailWhenInputIsNotMapLike() {
        WorkflowBlockEntity block = block("""
                {
                  "mode": "pick",
                  "fields": ["name"]
                }
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());
        ResolvedInput input = new ResolvedInput(Map.of(
                "value", "not-a-map"
        ));

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> mapNodeHandler.handle(block, input, context)
        );

        assertTrue(ex.getMessage().contains("map-like"));
    }

    private WorkflowBlockEntity block(String configJson) {
        return WorkflowBlockEntity.builder()
                .id(UUID.randomUUID())
                .type(BlockType.MAP)
                .name("Map")
                .position("{}")
                .config(configJson)
                .build();
    }
}

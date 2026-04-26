package com.ms.workerservice.execution.engine.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeAction;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.execution.engine.WaitState;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class WaitNodeHandlerTest {

    private WaitNodeHandler waitNodeHandler;

    @BeforeEach
    void setUp() {
        JsonHelper jsonHelper = new JsonHelper(new ObjectMapper());
        waitNodeHandler = new WaitNodeHandler(jsonHelper);
    }

    @Test
    void shouldReturnWaitActionWithConfiguredMetadata() {
        WorkflowBlockEntity block = block("""
                {
                  "waitType": "manual",
                  "resumeKey": "resume-123"
                }
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());
        ResolvedInput input = new ResolvedInput(Map.of(
                "value", Map.of("status", "pending")
        ));

        NodeResult result = waitNodeHandler.handle(block, input, context);

        assertEquals(NodeAction.WAIT, result.getAction());
        assertNotNull(result.getOutput());
        assertInstanceOf(WaitState.class, result.getOutput());

        WaitState waitState = (WaitState) result.getOutput();

        assertEquals("manual", waitState.waitType());
        assertEquals("resume-123", waitState.resumeKey());
        assertEquals(block.getId().toString(), waitState.waitingBlockId());
        assertEquals(Map.of("status", "pending"), waitState.input());
    }

    @Test
    void shouldUseBlockIdAsDefaultResumeKey() {
        WorkflowBlockEntity block = block("""
                {
                  "waitType": "manual"
                }
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());
        ResolvedInput input = ResolvedInput.empty();

        NodeResult result = waitNodeHandler.handle(block, input, context);

        assertInstanceOf(WaitState.class, result.getOutput());

        WaitState waitState = (WaitState) result.getOutput();

        assertEquals("manual", waitState.waitType());
        assertEquals(block.getId().toString(), waitState.resumeKey());
        assertEquals(block.getId().toString(), waitState.waitingBlockId());
        assertNull(waitState.input());
    }

    @Test
    void shouldUseInputsWhenSingleValueIsAbsent() {
        WorkflowBlockEntity block = block("""
                {}
                """);

        ExecutionContext context = new ExecutionContext(UUID.randomUUID(), UUID.randomUUID());
        ResolvedInput input = new ResolvedInput(Map.of(
                "inputs", Map.of("source-1", Map.of("approved", true))
        ));

        NodeResult result = waitNodeHandler.handle(block, input, context);

        assertInstanceOf(WaitState.class, result.getOutput());

        WaitState waitState = (WaitState) result.getOutput();

        assertEquals("manual", waitState.waitType());
        assertEquals(block.getId().toString(), waitState.resumeKey());
        assertEquals(block.getId().toString(), waitState.waitingBlockId());
        assertEquals(Map.of("source-1", Map.of("approved", true)), waitState.input());
    }

    private WorkflowBlockEntity block(String configJson) {
        return WorkflowBlockEntity.builder()
                .id(UUID.randomUUID())
                .type(BlockType.WAIT)
                .name("Wait")
                .position("{}")
                .config(configJson)
                .build();
    }
}

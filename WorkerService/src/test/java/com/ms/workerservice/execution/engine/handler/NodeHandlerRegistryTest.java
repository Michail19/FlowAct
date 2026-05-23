package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NodeHandlerRegistryTest {

    @Test
    void getHandlerReturnsRegisteredHandler() {
        NodeHandler inputHandler = new StubNodeHandler(BlockType.INPUT);
        NodeHandlerRegistry registry = new NodeHandlerRegistry(List.of(inputHandler));

        NodeHandler handler = registry.getHandler(BlockType.INPUT);

        assertThat(handler).isSameAs(inputHandler);
    }

    @Test
    void getHandlerThrowsForUnsupportedBlockType() {
        NodeHandlerRegistry registry = new NodeHandlerRegistry(List.of(
                new StubNodeHandler(BlockType.START)
        ));

        assertThatThrownBy(() -> registry.getHandler(BlockType.FILTER))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Unsupported block type: FILTER");
    }

    @Test
    void constructorThrowsForDuplicateHandlers() {
        NodeHandler firstHandler = new StubNodeHandler(BlockType.HTTP_REQUEST);
        NodeHandler secondHandler = new StubNodeHandler(BlockType.HTTP_REQUEST);

        assertThatThrownBy(() -> new NodeHandlerRegistry(List.of(firstHandler, secondHandler)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Duplicate node handler for block type: HTTP_REQUEST");
    }

    private static class StubNodeHandler implements NodeHandler {
        private final BlockType blockType;

        private StubNodeHandler(BlockType blockType) {
            this.blockType = blockType;
        }

        @Override
        public BlockType getSupportedType() {
            return blockType;
        }

        @Override
        public NodeResult handle(
                WorkflowBlockEntity block,
                ResolvedInput input,
                ExecutionContext context
        ) {
            return NodeResult.empty();
        }
    }
}

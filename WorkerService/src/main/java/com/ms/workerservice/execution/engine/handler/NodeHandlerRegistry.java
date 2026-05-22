package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Component
public class NodeHandlerRegistry {

    private final Map<BlockType, NodeHandler> handlers = new EnumMap<>(BlockType.class);

    public NodeHandlerRegistry(List<NodeHandler> discoveredHandlers) {
        for (NodeHandler handler : discoveredHandlers) {
            NodeHandler previousHandler = handlers.put(handler.getSupportedType(), handler);

            if (previousHandler != null) {
                throw new IllegalStateException(
                        "Duplicate node handler for block type: " + handler.getSupportedType()
                );
            }
        }
    }

    public NodeHandler getHandler(BlockType blockType) {
        NodeHandler handler = handlers.get(blockType);

        if (handler == null) {
            throw new IllegalStateException("Unsupported block type: " + blockType);
        }

        return handler;
    }
}

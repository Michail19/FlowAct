package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Component
public class NodeHandlerRegistry {

    private final Map<BlockType, NodeHandler> handlers = new EnumMap<>(BlockType.class);
    private final DefaultPassThroughNodeHandler defaultPassThroughNodeHandler;

    public NodeHandlerRegistry(
            List<NodeHandler> discoveredHandlers,
            DefaultPassThroughNodeHandler defaultPassThroughNodeHandler
    ) {
        this.defaultPassThroughNodeHandler = defaultPassThroughNodeHandler;

        for (NodeHandler handler : discoveredHandlers) {
            handlers.put(handler.getSupportedType(), handler);
        }
    }

    public NodeHandler getHandler(BlockType blockType) {
        return handlers.getOrDefault(blockType, defaultPassThroughNodeHandler);
    }
}

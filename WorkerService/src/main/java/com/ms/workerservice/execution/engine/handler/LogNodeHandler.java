package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.execution.engine.TemplateRenderer;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Component
public class LogNodeHandler implements NodeHandler {

    private final JsonHelper jsonHelper;
    private final TemplateRenderer templateRenderer;

    public LogNodeHandler(JsonHelper jsonHelper, TemplateRenderer templateRenderer) {
        this.jsonHelper = jsonHelper;
        this.templateRenderer = templateRenderer;
    }

    @Override
    public BlockType getSupportedType() {
        return BlockType.LOG_MESSAGE;
    }

    @Override
    public NodeResult handle(
            WorkflowBlockEntity block,
            ResolvedInput input,
            ExecutionContext context
    ) {
        Map<String, Object> config = jsonHelper.toMap(block.getConfig());

        String level = getString(config, "level", "info").toLowerCase(Locale.ROOT);
        String messageTemplate = getString(config, "messageTemplate", "{{value}}");

        Object inputValue = input.getValue() != null
                ? input.getValue()
                : input.getInputs();

        String message = templateRenderer.render(messageTemplate, input, context);

        Map<String, Object> log = new LinkedHashMap<>();
        log.put("level", normalizeLevel(level));
        log.put("message", message);
        log.put("blockId", block.getId().toString());
        log.put("blockName", block.getName());

        Map<String, Object> output = new LinkedHashMap<>();

        /*
         * value сохраняет полезные данные предыдущего блока,
         * чтобы после логирования цепочка не теряла runtime-output.
         */
        output.put("value", inputValue);
        output.put("log", log);

        return NodeResult.of(output);
    }

    private String normalizeLevel(String level) {
        return switch (level) {
            case "warning", "warn" -> "warning";
            case "error" -> "error";
            case "info" -> "info";
            default -> "info";
        };
    }

    private String getString(
            Map<String, Object> config,
            String key,
            String fallback
    ) {
        Object value = config.get(key);

        if (value == null) {
            return fallback;
        }

        return String.valueOf(value);
    }
}

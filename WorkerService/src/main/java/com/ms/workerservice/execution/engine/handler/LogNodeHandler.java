package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Component
public class LogNodeHandler implements NodeHandler {

    private final JsonHelper jsonHelper;

    public LogNodeHandler(JsonHelper jsonHelper) {
        this.jsonHelper = jsonHelper;
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
        String messageTemplate = getString(config, "messageTemplate", "{{input}}");

        Object inputValue = input.getValue() != null
                ? input.getValue()
                : input.getValues();

        String message = renderTemplate(messageTemplate, input, context);

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

    private String renderTemplate(
            String template,
            ResolvedInput input,
            ExecutionContext context
    ) {
        if (template == null || template.isBlank()) {
            return "";
        }

        Object inputValue = input.getValue() != null
                ? input.getValue()
                : input.getValues();

        String inputJson = jsonHelper.toJson(inputValue);
        String valuesJson = jsonHelper.toJson(input.getValues());
        String variablesJson = jsonHelper.toJson(context.getVariables());
        String lastJson = jsonHelper.toJson(context.getLastSuccessfulOutput());

        return template
                .replace("{{input}}", safe(inputJson))
                .replace("{{value}}", safe(inputJson))
                .replace("{{values}}", safe(valuesJson))
                .replace("{{variables}}", safe(variablesJson))
                .replace("{{last}}", safe(lastJson));
    }

    private String normalizeLevel(String level) {
        return switch (level) {
            case "warning", "warn" -> "warning";
            case "error" -> "error";
            case "info" -> "info";
            default -> "info";
        };
    }

    private String safe(String value) {
        return value != null ? value : "";
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

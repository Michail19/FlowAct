package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.config.properties.MlServiceProperties;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.execution.engine.TemplateRenderer;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class MlRequestNodeHandler implements NodeHandler {

    private final JsonHelper jsonHelper;
    private final RestClient restClient;
    private final MlServiceProperties mlServiceProperties;
    private final TemplateRenderer templateRenderer;

    public MlRequestNodeHandler(
            JsonHelper jsonHelper,
            RestClient restClient,
            MlServiceProperties mlServiceProperties,
            TemplateRenderer templateRenderer
    ) {
        this.jsonHelper = jsonHelper;
        this.restClient = restClient;
        this.mlServiceProperties = mlServiceProperties;
        this.templateRenderer = templateRenderer;
    }

    @Override
    public BlockType getSupportedType() {
        return BlockType.ML_REQUEST;
    }

    @Override
    public NodeResult handle(
            WorkflowBlockEntity block,
            ResolvedInput input,
            ExecutionContext context
    ) {
        Map<String, Object> config = jsonHelper.toMap(block.getConfig());

        String rawPath = String.valueOf(
                config.getOrDefault("path", mlServiceProperties.predictPath())
        );
        String path = templateRenderer.render(rawPath, input, context);

        String url = normalizeUrl(mlServiceProperties.baseUrl(), path);

        Object requestBody = resolveRequestBody(config, input, context);

        try {
            ResponseEntity<String> response = restClient.post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .toEntity(String.class);

            Object parsedBody = parseResponseBody(response.getBody());

            Map<String, Object> output = new LinkedHashMap<>();
            output.put("status", response.getStatusCode().value());
            output.put("body", parsedBody);

            return NodeResult.of(output);

        } catch (RestClientResponseException ex) {
            Map<String, Object> errorOutput = new LinkedHashMap<>();
            errorOutput.put("status", ex.getStatusCode().value());
            errorOutput.put("body", parseResponseBody(ex.getResponseBodyAsString()));
            errorOutput.put("error", ex.getMessage());

            throw new IllegalStateException(
                    "ML request failed with status " + ex.getStatusCode().value()
                            + ": " + jsonHelper.toJson(errorOutput),
                    ex
            );

        } catch (Exception ex) {
            throw new IllegalStateException("ML request failed: " + ex.getMessage(), ex);
        }
    }

    private Object resolveRequestBody(
            Map<String, Object> config,
            ResolvedInput input,
            ExecutionContext context
    ) {
        if (config.containsKey("body")) {
            return templateRenderer.renderValue(config.get("body"), input, context);
        }

        if (config.containsKey("sourcePath")) {
            Object sourceValue = resolvePath(input, String.valueOf(config.get("sourcePath")));
            return Map.of("input", sourceValue);
        }

        if (config.containsKey("variableName")) {
            String variableName = templateRenderer.render(String.valueOf(config.get("variableName")), input, context);
            Object variableValue = context.getVariable(variableName);

            if (variableValue != null) {
                return Map.of("input", variableValue);
            }
        }

        if (input.getValue() != null) {
            return Map.of("input", input.getValue());
        }

        if (!input.getInputs().isEmpty()) {
            return Map.of("input", input.getInputs());
        }

        return Map.of("input", input.get("input"));
    }

    @SuppressWarnings("unchecked")
    private Object resolvePath(ResolvedInput input, String path) {
        if (path == null || path.isBlank()) {
            return input.getValue();
        }

        Object current = input.getValues();
        for (String segment : path.trim().split("\\.")) {
            if (current == null) {
                return null;
            }

            if (current instanceof Map<?, ?> map) {
                current = ((Map<String, Object>) map).get(segment);
                continue;
            }

            if (current instanceof java.util.List<?> list) {
                try {
                    int index = Integer.parseInt(segment);
                    current = index >= 0 && index < list.size() ? list.get(index) : null;
                    continue;
                } catch (NumberFormatException ex) {
                    return null;
                }
            }

            return null;
        }

        return current;
    }

    private Object parseResponseBody(String rawBody) {
        if (rawBody == null || rawBody.isBlank()) {
            return null;
        }

        if (jsonHelper.looksLikeJson(rawBody)) {
            try {
                return jsonHelper.toObject(rawBody);
            } catch (Exception ignored) {
            }
        }

        return rawBody;
    }

    private String normalizeUrl(String baseUrl, String path) {
        String normalizedBase = baseUrl.endsWith("/")
                ? baseUrl.substring(0, baseUrl.length() - 1)
                : baseUrl;

        String normalizedPath = path.startsWith("/") ? path : "/" + path;

        return normalizedBase + normalizedPath;
    }
}

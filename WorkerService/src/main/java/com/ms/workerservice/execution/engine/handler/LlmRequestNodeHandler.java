package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.config.properties.OpenRouterProperties;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class LlmRequestNodeHandler implements NodeHandler {

    private final JsonHelper jsonHelper;
    private final RestClient restClient;
    private final OpenRouterProperties openRouterProperties;

    public LlmRequestNodeHandler(
            JsonHelper jsonHelper,
            RestClient restClient,
            OpenRouterProperties openRouterProperties
    ) {
        this.jsonHelper = jsonHelper;
        this.restClient = restClient;
        this.openRouterProperties = openRouterProperties;
    }

    @Override
    public BlockType getSupportedType() {
        return BlockType.LLM_REQUEST;
    }

    @Override
    public NodeResult handle(
            WorkflowBlockEntity block,
            ResolvedInput input,
            ExecutionContext context
    ) {
        if (openRouterProperties.apiKey() == null || openRouterProperties.apiKey().isBlank()) {
            throw new IllegalStateException("OpenRouter API key is not configured");
        }

        Map<String, Object> config = jsonHelper.toMap(block.getConfig());

        String url = normalizeUrl(
                openRouterProperties.baseUrl(),
                openRouterProperties.chatPath()
        );

        Map<String, Object> requestBody = buildRequestBody(config, input, context);

        try {
            ResponseEntity<String> response = restClient.post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + openRouterProperties.apiKey())
                    .headers(headers -> {
                        if (openRouterProperties.siteUrl() != null && !openRouterProperties.siteUrl().isBlank()) {
                            headers.add("HTTP-Referer", openRouterProperties.siteUrl());
                        }
                        if (openRouterProperties.appName() != null && !openRouterProperties.appName().isBlank()) {
                            headers.add("X-Title", openRouterProperties.appName());
                        }
                    })
                    .body(requestBody)
                    .retrieve()
                    .toEntity(String.class);

            Object parsedBody = parseResponseBody(response.getBody());
            String assistantText = extractAssistantText(parsedBody);

            Map<String, Object> output = new LinkedHashMap<>();
            output.put("status", response.getStatusCode().value());
            output.put("body", parsedBody);
            output.put("text", assistantText);

            return NodeResult.of(output);

        } catch (RestClientResponseException ex) {
            Map<String, Object> errorOutput = new LinkedHashMap<>();
            errorOutput.put("status", ex.getStatusCode().value());
            errorOutput.put("body", parseResponseBody(ex.getResponseBodyAsString()));
            errorOutput.put("error", ex.getMessage());

            throw new IllegalStateException(
                    "OpenRouter request failed with status " + ex.getStatusCode().value()
                            + ": " + jsonHelper.toJson(errorOutput),
                    ex
            );

        } catch (Exception ex) {
            throw new IllegalStateException("OpenRouter request failed: " + ex.getMessage(), ex);
        }
    }

    private Map<String, Object> buildRequestBody(
            Map<String, Object> config,
            ResolvedInput input,
            ExecutionContext context
    ) {
        String model = stringOrDefault(config.get("model"), openRouterProperties.defaultModel());
        String systemPrompt = stringOrNull(config.get("systemPrompt"));
        String userPrompt = resolveUserPrompt(config, input, context);

        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put("model", model);
        requestBody.put("messages", buildMessages(systemPrompt, userPrompt));

        if (config.containsKey("temperature")) {
            requestBody.put("temperature", config.get("temperature"));
        }

        if (config.containsKey("maxTokens")) {
            requestBody.put("max_tokens", config.get("maxTokens"));
        }

        return requestBody;
    }

    private List<Map<String, Object>> buildMessages(String systemPrompt, String userPrompt) {
        if (systemPrompt != null && !systemPrompt.isBlank()) {
            return List.of(
                    Map.of("role", "system", "content", systemPrompt),
                    Map.of("role", "user", "content", userPrompt)
            );
        }

        return List.of(
                Map.of("role", "user", "content", userPrompt)
        );
    }

    private String resolveUserPrompt(
            Map<String, Object> config,
            ResolvedInput input,
            ExecutionContext context
    ) {
        if (config.containsKey("prompt")) {
            return String.valueOf(config.get("prompt"));
        }

        Object variableName = config.get("variableName");
        if (variableName != null && !String.valueOf(variableName).isBlank()) {
            Object variableValue = context.getVariable(String.valueOf(variableName));
            if (variableValue != null) {
                return stringifyPromptValue(variableValue);
            }
        }

        if (input.getValue() != null) {
            return stringifyPromptValue(input.getValue());
        }

        if (!input.getInputs().isEmpty()) {
            return stringifyPromptValue(input.getInputs());
        }

        throw new IllegalStateException("LLM_REQUEST requires prompt, variableName, or input value");
    }

    private String stringifyPromptValue(Object value) {
        if (value instanceof String str) {
            return str;
        }
        return jsonHelper.toJson(value);
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

    @SuppressWarnings("unchecked")
    private String extractAssistantText(Object parsedBody) {
        if (!(parsedBody instanceof Map<?, ?> bodyMap)) {
            return null;
        }

        Object choicesRaw = bodyMap.get("choices");
        if (!(choicesRaw instanceof List<?> choices) || choices.isEmpty()) {
            return null;
        }

        Object firstChoice = choices.get(0);
        if (!(firstChoice instanceof Map<?, ?> choiceMap)) {
            return null;
        }

        Object messageRaw = choiceMap.get("message");
        if (!(messageRaw instanceof Map<?, ?> messageMap)) {
            return null;
        }

        Object content = messageMap.get("content");
        return content != null ? String.valueOf(content) : null;
    }

    private String normalizeUrl(String baseUrl, String path) {
        String normalizedBase = baseUrl.endsWith("/")
                ? baseUrl.substring(0, baseUrl.length() - 1)
                : baseUrl;

        String normalizedPath = path.startsWith("/") ? path : "/" + path;

        return normalizedBase + normalizedPath;
    }

    private String stringOrDefault(Object value, String defaultValue) {
        if (value == null || String.valueOf(value).isBlank()) {
            return defaultValue;
        }
        return String.valueOf(value);
    }

    private String stringOrNull(Object value) {
        if (value == null || String.valueOf(value).isBlank()) {
            return null;
        }
        return String.valueOf(value);
    }
}

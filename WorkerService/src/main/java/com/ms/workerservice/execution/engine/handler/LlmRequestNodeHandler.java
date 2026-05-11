package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.config.properties.OpenRouterProperties;
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
import java.util.List;
import java.util.Map;

@Component
public class LlmRequestNodeHandler implements NodeHandler {

    private static final String FREE_ROUTER_MODEL = "openrouter/free";
    private static final int DEFAULT_MAX_INPUT_CHARS = 12_000;
    private static final int HARD_MAX_INPUT_CHARS = 50_000;
    private static final int MIN_INPUT_CHARS = 1_000;

    private static final Map<String, String> LEGACY_FREE_MODEL_ALIASES = Map.of(
            "openai-gpt-4o", "openai/gpt-oss-120b:free",
            "openai-gpt-4o-mini", "openai/gpt-oss-20b:free",
            "anthropic-claude-sonnet", FREE_ROUTER_MODEL,
            "google-gemini-pro", "google/gemma-4-31b-it:free",
            "mistral-large", FREE_ROUTER_MODEL,
            "deepseek-chat", FREE_ROUTER_MODEL
    );

    private enum AiInputMode {
        NONE,
        SMART,
        FULL,
        TEMPLATE_ONLY
    }

    private final JsonHelper jsonHelper;
    private final RestClient restClient;
    private final OpenRouterProperties openRouterProperties;
    private final TemplateRenderer templateRenderer;

    public LlmRequestNodeHandler(
            JsonHelper jsonHelper,
            RestClient restClient,
            OpenRouterProperties openRouterProperties,
            TemplateRenderer templateRenderer
    ) {
        this.jsonHelper = jsonHelper;
        this.restClient = restClient;
        this.openRouterProperties = openRouterProperties;
        this.templateRenderer = templateRenderer;
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
            throw new IllegalStateException(
                    "Не настроен OpenRouter API key. Укажите ключ в переменной окружения WorkerService."
            );
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
                            headers.add("X-OpenRouter-Title", openRouterProperties.appName());
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
        String model = resolveModel(config);
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

    private String resolveModel(Map<String, Object> config) {
        String configuredModel = stringOrNull(config.get("model"));

        if (configuredModel == null) {
            configuredModel = getFirstConfiguredModel(config.get("models"));
        }

        String defaultModel = stringOrDefault(openRouterProperties.defaultModel(), FREE_ROUTER_MODEL);
        String model = normalizeModelId(stringOrDefault(configuredModel, defaultModel));

        if (!openRouterProperties.isPaidModelAllowed() && !isFreeModel(model)) {
            throw new IllegalStateException(
                    "Paid OpenRouter model is blocked by configuration: " + model
                            + ". Use openrouter/free or a model id ending with :free."
            );
        }

        return model;
    }

    private String getFirstConfiguredModel(Object modelsValue) {
        if (modelsValue instanceof List<?> models) {
            return models.stream()
                    .filter(model -> model != null && !String.valueOf(model).isBlank())
                    .map(String::valueOf)
                    .findFirst()
                    .orElse(null);
        }

        return null;
    }

    private String normalizeModelId(String model) {
        String trimmedModel = model.trim();
        return LEGACY_FREE_MODEL_ALIASES.getOrDefault(trimmedModel, trimmedModel);
    }

    private boolean isFreeModel(String model) {
        return FREE_ROUTER_MODEL.equals(model) || model.endsWith(":free");
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
        String configuredPrompt = stringOrNull(config.get("prompt"));
        AiInputMode inputMode = resolveInputMode(config);

        if (configuredPrompt != null) {
            if (templateRenderer.containsPlaceholders(configuredPrompt)) {
                String renderedPrompt = templateRenderer.render(configuredPrompt, input, context);

                return limitText(renderedPrompt, resolveMaxInputChars(config) + configuredPrompt.length());
            }

            if (inputMode == AiInputMode.TEMPLATE_ONLY || inputMode == AiInputMode.NONE) {
                return configuredPrompt;
            }

            String contextText = buildContextText(config, input, context);

            if (contextText == null) {
                return configuredPrompt;
            }

            return configuredPrompt
                    + "\n\nДанные из предыдущего блока:\n"
                    + contextText;
        }

        String contextText = buildContextText(config, input, context);

        if (contextText != null) {
            return contextText;
        }

        throw new IllegalStateException(
                "AI-блок не получил текст запроса. Заполните поле prompt или подключите входящий блок с данными."
        );
    }

    private Object resolvePromptContextValue(
            Map<String, Object> config,
            ResolvedInput input,
            ExecutionContext context
    ) {
        Object variableName = config.get("variableName");

        if (variableName != null && !String.valueOf(variableName).isBlank()) {
            Object variableValue = context.getVariable(String.valueOf(variableName));

            if (variableValue != null) {
                return variableValue;
            }
        }

        if (input.getValue() != null) {
            return input.getValue();
        }

        if (!input.getInputs().isEmpty()) {
            return input.getInputs();
        }

        return null;
    }

    private boolean containsInputPlaceholder(String prompt) {
        return prompt.contains("{{input}}")
                || prompt.contains("{{value}}")
                || prompt.contains("{{inputs}}")
                || prompt.contains("{{variables}}");
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

    private AiInputMode resolveInputMode(Map<String, Object> config) {
        Object rawValue = config.getOrDefault("inputMode", "smart");

        try {
            return AiInputMode.valueOf(String.valueOf(rawValue).trim().toUpperCase());
        } catch (Exception ex) {
            return AiInputMode.SMART;
        }
    }

    private int resolveMaxInputChars(Map<String, Object> config) {
        Object rawValue = config.get("maxInputChars");

        if (rawValue == null) {
            return DEFAULT_MAX_INPUT_CHARS;
        }

        try {
            int value = Integer.parseInt(String.valueOf(rawValue));

            if (value < MIN_INPUT_CHARS) {
                return MIN_INPUT_CHARS;
            }

            return Math.min(value, HARD_MAX_INPUT_CHARS);
        } catch (NumberFormatException ex) {
            return DEFAULT_MAX_INPUT_CHARS;
        }
    }

    @SuppressWarnings("unchecked")
    private Object extractSmartInput(Object value) {
        if (!(value instanceof Map<?, ?> map)) {
            return value;
        }

        Object text = firstExistingPath(
                map,
                List.of(
                        List.of("text"),
                        List.of("body", "extract"),
                        List.of("body", "summary"),
                        List.of("body", "description"),
                        List.of("body", "title"),
                        List.of("body", "text"),
                        List.of("body", "content"),
                        List.of("body")
                )
        );

        if (text != null) {
            Map<String, Object> smartValue = new LinkedHashMap<>();
            smartValue.put("text", text);

            Object status = getByPath(map, List.of("status"));
            if (status != null) {
                smartValue.put("status", status);
            }

            Object title = firstExistingPath(
                    map,
                    List.of(
                            List.of("body", "title"),
                            List.of("title")
                    )
            );

            if (title != null) {
                smartValue.put("title", title);
            }

            Object url = firstExistingPath(
                    map,
                    List.of(
                            List.of("url"),
                            List.of("body", "content_urls", "desktop", "page")
                    )
            );

            if (url != null) {
                smartValue.put("url", url);
            }

            return smartValue;
        }

        return value;
    }

    private Object firstExistingPath(Map<?, ?> map, List<List<String>> paths) {
        for (List<String> path : paths) {
            Object value = getByPath(map, path);

            if (value != null) {
                return value;
            }
        }

        return null;
    }

    private Object getByPath(Object source, List<String> path) {
        Object currentValue = source;

        for (String part : path) {
            if (currentValue instanceof Map<?, ?> mapValue) {
                currentValue = mapValue.get(part);
                continue;
            }

            if (currentValue instanceof List<?> listValue) {
                int index;

                try {
                    index = Integer.parseInt(part);
                } catch (NumberFormatException ex) {
                    return null;
                }

                if (index < 0 || index >= listValue.size()) {
                    return null;
                }

                currentValue = listValue.get(index);
                continue;
            }

            return null;
        }

        return currentValue;
    }

    private String limitText(String value, int maxChars) {
        if (value == null || value.length() <= maxChars) {
            return value;
        }

        return value.substring(0, maxChars)
                + "\n\n[FlowAct: входные данные сокращены. Исходный размер: "
                + value.length()
                + " символов, лимит: "
                + maxChars
                + ". Укажите точный путь вроде {{input.body.extract}}, чтобы передать меньше данных.]";
    }

    private String buildContextText(
            Map<String, Object> config,
            ResolvedInput input,
            ExecutionContext context
    ) {
        AiInputMode inputMode = resolveInputMode(config);
        int maxInputChars = resolveMaxInputChars(config);

        if (inputMode == AiInputMode.NONE || inputMode == AiInputMode.TEMPLATE_ONLY) {
            return null;
        }

        Object contextValue = resolvePromptContextValue(config, input, context);

        if (contextValue == null) {
            return null;
        }

        Object valueForPrompt = inputMode == AiInputMode.SMART
                ? extractSmartInput(contextValue)
                : contextValue;

        String contextText = stringifyPromptValue(valueForPrompt);

        return limitText(contextText, maxInputChars);
    }
}

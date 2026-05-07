package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.execution.engine.TemplateRenderer;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class HttpRequestNodeHandler implements NodeHandler {

    private final JsonHelper jsonHelper;
    private final RestClient restClient;
    private final TemplateRenderer templateRenderer;

    public HttpRequestNodeHandler(
            JsonHelper jsonHelper,
            RestClient restClient,
            TemplateRenderer templateRenderer
    ) {
        this.jsonHelper = jsonHelper;
        this.restClient = restClient;
        this.templateRenderer = templateRenderer;
    }

    @Override
    public BlockType getSupportedType() {
        return BlockType.HTTP_REQUEST;
    }

    @Override
    public NodeResult handle(
            WorkflowBlockEntity block,
            ResolvedInput input,
            ExecutionContext context
    ) {
        Map<String, Object> config = jsonHelper.toMap(block.getConfig());

        String rawUrl = getRequiredString(config, "url");
        String url = templateRenderer.render(rawUrl, input, context);

        String methodRaw = String.valueOf(config.getOrDefault("method", "GET"))
                .trim()
                .toUpperCase();

        HttpMethod method = HttpMethod.valueOf(methodRaw);

        Map<String, String> headers = extractHeaders(config, input, context);
        Object body = resolveBody(config, input, context);

        try {
            ResponseEntity<String> response = executeRequest(url, method, headers, body);

            Object parsedBody = parseResponseBody(response.getBody());

            Map<String, Object> output = new LinkedHashMap<>();
            output.put("status", response.getStatusCode().value());
            output.put("headers", response.getHeaders().toSingleValueMap());
            output.put("body", parsedBody);

            return NodeResult.of(output);

        } catch (RestClientResponseException ex) {
            Map<String, Object> errorOutput = new LinkedHashMap<>();
            errorOutput.put("status", ex.getStatusCode().value());
            errorOutput.put("headers", ex.getResponseHeaders() != null
                    ? ex.getResponseHeaders().toSingleValueMap()
                    : Map.of());
            errorOutput.put("body", parseResponseBody(ex.getResponseBodyAsString()));
            errorOutput.put("error", ex.getMessage());

            throw new IllegalStateException(
                    buildHttpErrorMessage(url, ex, errorOutput),
                    ex
            );

        } catch (Exception ex) {
            throw new IllegalStateException("HTTP request failed: " + ex.getMessage(), ex);
        }
    }

    private String buildHttpErrorMessage(
            String url,
            RestClientResponseException ex,
            Map<String, Object> errorOutput
    ) {
        Object body = errorOutput.get("body");
        String bodyText = body != null ? String.valueOf(body) : "";

        String pageTitle = extractHtmlTitle(bodyText);

        if (pageTitle != null && !pageTitle.isBlank()) {
            return "HTTP-запрос к " + url + " завершился ошибкой "
                    + ex.getStatusCode().value()
                    + ". Сервер вернул страницу: \"" + pageTitle + "\".";
        }

        return "HTTP-запрос к " + url + " завершился ошибкой "
                + ex.getStatusCode().value()
                + ". Проверьте URL, headers и доступность сервиса.";
    }

    private String extractHtmlTitle(String html) {
        if (html == null || html.isBlank()) {
            return null;
        }

        java.util.regex.Matcher matcher = java.util.regex.Pattern
                .compile("<title>(.*?)</title>", java.util.regex.Pattern.CASE_INSENSITIVE | java.util.regex.Pattern.DOTALL)
                .matcher(html);

        if (!matcher.find()) {
            return null;
        }

        return matcher.group(1)
                .replaceAll("\\s+", " ")
                .trim();
    }

    private ResponseEntity<String> executeRequest(
            String url,
            HttpMethod method,
            Map<String, String> headers,
            Object body
    ) {
        RestClient.RequestBodySpec spec = restClient.method(method)
                .uri(url)
                .headers(httpHeaders -> headers.forEach(httpHeaders::add));

        if (body != null && allowsBody(method)) {
            return spec
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .toEntity(String.class);
        }

        return spec
                .retrieve()
                .toEntity(String.class);
    }

    private boolean allowsBody(HttpMethod method) {
        return method == HttpMethod.POST
                || method == HttpMethod.PUT
                || method == HttpMethod.PATCH;
    }

    private Object resolveBody(
            Map<String, Object> config,
            ResolvedInput input,
            ExecutionContext context
    ) {
        if (config.containsKey("body")) {
            return templateRenderer.renderValue(config.get("body"), input, context);
        }

        if (input.getValue() != null) {
            return input.getValue();
        }

        if (!input.getInputs().isEmpty()) {
            return input.getInputs();
        }

        return null;
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
    private Map<String, String> extractHeaders(
            Map<String, Object> config,
            ResolvedInput input,
            ExecutionContext context
    ) {
        Object rawHeaders = config.get("headers");

        if (!(rawHeaders instanceof Map<?, ?> map)) {
            return Map.of();
        }

        Map<String, String> headers = new LinkedHashMap<>();

        for (Map.Entry<?, ?> entry : map.entrySet()) {
            String key = String.valueOf(entry.getKey());
            String value = templateRenderer.render(
                    String.valueOf(entry.getValue()),
                    input,
                    context
            );

            headers.put(key, value);
        }

        return headers;
    }

    private String getRequiredString(Map<String, Object> config, String key) {
        Object value = config.get(key);

        if (value == null || String.valueOf(value).isBlank()) {
            throw new IllegalStateException("HTTP_REQUEST block requires config." + key);
        }

        return String.valueOf(value);
    }
}

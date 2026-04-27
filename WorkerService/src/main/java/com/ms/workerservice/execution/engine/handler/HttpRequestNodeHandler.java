package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
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

    public HttpRequestNodeHandler(JsonHelper jsonHelper, RestClient restClient) {
        this.jsonHelper = jsonHelper;
        this.restClient = restClient;
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

        String url = getRequiredString(config, "url");
        String methodRaw = String.valueOf(config.getOrDefault("method", "GET")).trim().toUpperCase();
        HttpMethod method = HttpMethod.valueOf(methodRaw);

        Map<String, String> headers = extractHeaders(config);
        Object body = resolveBody(config, input);

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
                    "HTTP request failed with status " + ex.getStatusCode().value()
                            + ": " + jsonHelper.toJson(errorOutput),
                    ex
            );

        } catch (Exception ex) {
            throw new IllegalStateException("HTTP request failed: " + ex.getMessage(), ex);
        }
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

    private Object resolveBody(Map<String, Object> config, ResolvedInput input) {
        if (config.containsKey("body")) {
            return config.get("body");
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
    private Map<String, String> extractHeaders(Map<String, Object> config) {
        Object rawHeaders = config.get("headers");

        if (!(rawHeaders instanceof Map<?, ?> map)) {
            return Map.of();
        }

        Map<String, String> headers = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            headers.put(String.valueOf(entry.getKey()), String.valueOf(entry.getValue()));
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

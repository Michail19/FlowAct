package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.execution.engine.TemplateRenderer;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Component
public class HttpRequestNodeHandler implements NodeHandler {

    private final JsonHelper jsonHelper;
    private final RestClient restClient;
    private final TemplateRenderer templateRenderer;
    private final boolean allowPrivateNetworkRequests;

    private static final int DEFAULT_TIMEOUT_MS = 10_000;
    private static final int MIN_TIMEOUT_MS = 1_000;
    private static final int HARD_MAX_TIMEOUT_MS = 60_000;

    private static final int DEFAULT_MAX_RESPONSE_CHARS = 50_000;
    private static final int MIN_MAX_RESPONSE_CHARS = 1_000;
    private static final int HARD_MAX_RESPONSE_CHARS = 200_000;

    private enum ResponseMode {
        AUTO,
        JSON,
        TEXT
    }

    public HttpRequestNodeHandler(
            JsonHelper jsonHelper,
            RestClient restClient,
            TemplateRenderer templateRenderer,
            @Value("${flowact.http-block.allow-private-network:false}") boolean allowPrivateNetworkRequests
    ) {
        this.jsonHelper = jsonHelper;
        this.restClient = restClient;
        this.templateRenderer = templateRenderer;
        this.allowPrivateNetworkRequests = allowPrivateNetworkRequests;
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
        validateUrlSafety(url);

        String methodRaw = String.valueOf(config.getOrDefault("method", "GET"))
                .trim()
                .toUpperCase(Locale.ROOT);

        HttpMethod method = HttpMethod.valueOf(methodRaw);

        Map<String, String> headers = extractHeaders(config, input, context);
        Object body = resolveBody(config, input, context);

        int timeoutMs = resolveInt(
                config,
                "timeoutMs",
                DEFAULT_TIMEOUT_MS,
                MIN_TIMEOUT_MS,
                HARD_MAX_TIMEOUT_MS
        );

        int maxResponseChars = resolveInt(
                config,
                "maxResponseChars",
                DEFAULT_MAX_RESPONSE_CHARS,
                MIN_MAX_RESPONSE_CHARS,
                HARD_MAX_RESPONSE_CHARS
        );

        ResponseMode responseMode = resolveResponseMode(config);
        boolean continueOnError = Boolean.parseBoolean(
                String.valueOf(config.getOrDefault("continueOnError", false))
        );

        try {
            ResponseEntity<String> response = executeRequest(
                    url,
                    method,
                    headers,
                    body,
                    timeoutMs
            );

            Object parsedBody = parseResponseBody(
                    response.getBody(),
                    responseMode,
                    maxResponseChars
            );

            Map<String, Object> output = new LinkedHashMap<>();
            output.put("ok", response.getStatusCode().is2xxSuccessful());
            output.put("status", response.getStatusCode().value());
            output.put("method", method.name());
            output.put("url", url);
            output.put("headers", response.getHeaders().toSingleValueMap());
            output.put("body", parsedBody);

            return NodeResult.of(output);
        } catch (RestClientResponseException ex) {
            Map<String, Object> errorOutput = new LinkedHashMap<>();
            errorOutput.put("ok", false);
            errorOutput.put("status", ex.getStatusCode().value());
            errorOutput.put("method", method.name());
            errorOutput.put("url", url);
            errorOutput.put("headers", ex.getResponseHeaders() != null
                    ? ex.getResponseHeaders().toSingleValueMap()
                    : Map.of());
            errorOutput.put(
                    "body",
                    parseResponseBody(
                            ex.getResponseBodyAsString(),
                            responseMode,
                            maxResponseChars
                    )
            );
            errorOutput.put("error", ex.getMessage());

            if (continueOnError) {
                return NodeResult.of(errorOutput);
            }

            throw new IllegalStateException(
                    buildHttpErrorMessage(url, ex, errorOutput),
                    ex
            );
        } catch (Exception ex) {
            throw new IllegalStateException("HTTP request failed: " + ex.getMessage(), ex);
        }
    }

    private void validateUrlSafety(String url) {
        URI uri = toUri(url);
        String scheme = uri.getScheme();
        String host = uri.getHost();

        if (scheme == null
                || !("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))) {
            throw new IllegalStateException("HTTP_REQUEST supports only http and https URLs: " + url);
        }

        if (host == null || host.isBlank()) {
            throw new IllegalStateException("HTTP_REQUEST URL must contain host: " + url);
        }

        if (allowPrivateNetworkRequests) {
            return;
        }

        if (isLocalHostName(host)) {
            throw new IllegalStateException(
                    "HTTP_REQUEST to localhost/private network is disabled: " + host
            );
        }

        try {
            for (InetAddress address : InetAddress.getAllByName(host)) {
                if (isPrivateAddress(address)) {
                    throw new IllegalStateException(
                            "HTTP_REQUEST to localhost/private network is disabled: " + host
                    );
                }
            }
        } catch (UnknownHostException ex) {
            throw new IllegalStateException("HTTP_REQUEST host cannot be resolved: " + host, ex);
        }
    }

    private boolean isLocalHostName(String host) {
        String normalizedHost = host.trim().toLowerCase(Locale.ROOT);
        return "localhost".equals(normalizedHost)
                || normalizedHost.endsWith(".localhost")
                || normalizedHost.endsWith(".local")
                || "0.0.0.0".equals(normalizedHost)
                || "127.0.0.1".equals(normalizedHost)
                || "::1".equals(normalizedHost);
    }

    private boolean isPrivateAddress(InetAddress address) {
        return address.isAnyLocalAddress()
                || address.isLoopbackAddress()
                || address.isLinkLocalAddress()
                || address.isSiteLocalAddress();
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
            Object body,
            int timeoutMs
    ) {
        RestClient client = timeoutMs == DEFAULT_TIMEOUT_MS
                ? restClient
                : createRestClient(timeoutMs);

        RestClient.RequestBodySpec spec = client.method(method)
                .uri(toUri(url))
                .headers(httpHeaders -> headers.forEach(httpHeaders::add));

        if (body != null && allowsBody(method)) {
            if (!hasContentType(headers)) {
                spec.contentType(MediaType.APPLICATION_JSON);
            }

            return spec
                    .body(body)
                    .retrieve()
                    .toEntity(String.class);
        }

        return spec
                .retrieve()
                .toEntity(String.class);
    }

    private RestClient createRestClient(int timeoutMs) {
        SimpleClientHttpRequestFactory requestFactory =
                new SimpleClientHttpRequestFactory();

        requestFactory.setConnectTimeout(Math.min(5_000, timeoutMs));
        requestFactory.setReadTimeout(timeoutMs);

        return RestClient.builder()
                .requestFactory(requestFactory)
                .build();
    }

    private URI toUri(String url) {
        try {
            return URI.create(url);
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("Некорректный URL HTTP-запроса: " + url, ex);
        }
    }

    private boolean hasContentType(Map<String, String> headers) {
        return headers.keySet().stream()
                .anyMatch(HttpHeaders.CONTENT_TYPE::equalsIgnoreCase);
    }

    private int resolveInt(
            Map<String, Object> config,
            String key,
            int defaultValue,
            int minValue,
            int maxValue
    ) {
        Object rawValue = config.get(key);

        if (rawValue == null) {
            return defaultValue;
        }

        try {
            int value = Integer.parseInt(String.valueOf(rawValue));

            if (value < minValue) {
                return minValue;
            }

            return Math.min(value, maxValue);
        } catch (NumberFormatException ex) {
            return defaultValue;
        }
    }

    private ResponseMode resolveResponseMode(Map<String, Object> config) {
        Object rawValue = config.getOrDefault("responseMode", "auto");

        try {
            return ResponseMode.valueOf(String.valueOf(rawValue).trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            return ResponseMode.AUTO;
        }
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

    private Object parseResponseBody(
            String rawBody,
            ResponseMode responseMode,
            int maxResponseChars
    ) {
        if (rawBody == null || rawBody.isBlank()) {
            return null;
        }

        String limitedBody = limitText(rawBody, maxResponseChars);

        if (responseMode == ResponseMode.TEXT) {
            return limitedBody;
        }

        if (responseMode == ResponseMode.JSON || jsonHelper.looksLikeJson(limitedBody)) {
            try {
                return jsonHelper.toObject(limitedBody);
            } catch (Exception ex) {
                if (responseMode == ResponseMode.JSON) {
                    throw new IllegalStateException(
                            "HTTP-ответ ожидался как JSON, но его не удалось распарсить.",
                            ex
                    );
                }
            }
        }

        return limitedBody;
    }

    private String limitText(String value, int maxChars) {
        if (value == null || value.length() <= maxChars) {
            return value;
        }

        return value.substring(0, maxChars)
                + "\n\n[FlowAct: HTTP-ответ сокращён. Исходный размер: "
                + value.length()
                + " символов, лимит: "
                + maxChars
                + ".]";
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

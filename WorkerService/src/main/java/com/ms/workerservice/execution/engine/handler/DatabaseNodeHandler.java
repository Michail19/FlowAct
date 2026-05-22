package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.execution.engine.TemplateRenderer;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Component
public class DatabaseNodeHandler implements NodeHandler {

    private static final Pattern SAFE_TABLE_NAME_PATTERN = Pattern.compile(
            "^[a-zA-Z_][a-zA-Z0-9_]*(\\.[a-zA-Z_][a-zA-Z0-9_]*)?$"
    );

    private static final Pattern SQL_COMMENT_PATTERN = Pattern.compile(
            "(--.*?$)|(/\\*.*?\\*/)",
            Pattern.MULTILINE | Pattern.DOTALL
    );

    private static final Set<String> SUPPORTED_OPERATIONS = Set.of(
            "select",
            "insert",
            "update",
            "delete"
    );

    private static final Set<String> DANGEROUS_KEYWORDS = Set.of(
            "alter",
            "analyze",
            "call",
            "copy",
            "create",
            "discard",
            "drop",
            "execute",
            "grant",
            "listen",
            "notify",
            "reassign",
            "refresh",
            "reindex",
            "reset",
            "revoke",
            "security",
            "set",
            "truncate",
            "unlisten",
            "vacuum"
    );

    private static final Set<String> SYSTEM_SCHEMA_PREFIXES = Set.of(
            "pg_catalog.",
            "information_schema.",
            "pg_toast."
    );

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final JsonHelper jsonHelper;
    private final TemplateRenderer templateRenderer;
    private final boolean writeEnabled;
    private final boolean allowDangerousSql;
    private final int maxSelectRows;

    public DatabaseNodeHandler(
            NamedParameterJdbcTemplate jdbcTemplate,
            JsonHelper jsonHelper,
            TemplateRenderer templateRenderer,
            @Value("${flowact.database-block.write-enabled:false}") boolean writeEnabled,
            @Value("${flowact.database-block.allow-dangerous-sql:false}") boolean allowDangerousSql,
            @Value("${flowact.database-block.max-select-rows:100}") int maxSelectRows
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.jsonHelper = jsonHelper;
        this.templateRenderer = templateRenderer;
        this.writeEnabled = writeEnabled;
        this.allowDangerousSql = allowDangerousSql;
        this.maxSelectRows = Math.max(1, maxSelectRows);
    }

    @Override
    public BlockType getSupportedType() {
        return BlockType.DATABASE_QUERY;
    }

    @Override
    public NodeResult handle(
            WorkflowBlockEntity block,
            ResolvedInput input,
            ExecutionContext context
    ) {
        Map<String, Object> config = jsonHelper.toMap(block.getConfig());

        String operation = templateRenderer.render(getString(config, "operation", "select"), input, context)
                .trim()
                .toLowerCase(Locale.ROOT);
        String tableName = templateRenderer.render(getString(config, "tableName", ""), input, context).trim();
        String query = templateRenderer.render(getString(config, "query", ""), input, context).trim();

        validateOperation(operation);
        validateTableNameIfProvided(tableName);

        Map<String, Object> params = toParameterMap(
                templateRenderer.renderValue(config.get("payload"), input, context)
        );

        if (query.isBlank()) {
            query = buildQueryFromTableName(operation, tableName);
        }

        validateQuery(operation, query);

        if ("select".equals(operation)) {
            String limitedQuery = applyLimitIfNeeded(query);

            var rows = jdbcTemplate.queryForList(limitedQuery, params);

            Map<String, Object> output = new LinkedHashMap<>();
            output.put("operation", operation);
            output.put("tableName", tableName);
            output.put("query", limitedQuery);
            output.put("count", rows.size());
            output.put("rows", rows);

            return NodeResult.of(output);
        }

        if (!writeEnabled) {
            throw new IllegalStateException(
                    "Database write operations are disabled. "
                            + "Set FLOWACT_DATABASE_BLOCK_WRITE_ENABLED=true to enable them."
            );
        }

        int rowsAffected = jdbcTemplate.update(query, params);

        Map<String, Object> output = new LinkedHashMap<>();
        output.put("operation", operation);
        output.put("tableName", tableName);
        output.put("query", query);
        output.put("rowsAffected", rowsAffected);

        return NodeResult.of(output);
    }

    private String buildQueryFromTableName(String operation, String tableName) {
        if (tableName == null || tableName.isBlank()) {
            throw new IllegalArgumentException(
                    "Database block requires either query or tableName."
            );
        }

        validateTableNameIfProvided(tableName);

        if ("select".equals(operation)) {
            return "SELECT * FROM " + tableName;
        }

        throw new IllegalArgumentException(
                "Query is required for operation: " + operation
        );
    }

    private void validateOperation(String operation) {
        if (!SUPPORTED_OPERATIONS.contains(operation)) {
            throw new IllegalArgumentException(
                    "Unsupported database operation: " + operation
            );
        }
    }

    private void validateTableNameIfProvided(String tableName) {
        if (tableName == null || tableName.isBlank()) {
            return;
        }

        if (!SAFE_TABLE_NAME_PATTERN.matcher(tableName).matches()) {
            throw new IllegalArgumentException(
                    "Invalid tableName. Only simple table names are allowed."
            );
        }

        assertNotSystemSchemaReference(tableName.toLowerCase(Locale.ROOT));
    }

    private void validateQuery(String operation, String query) {
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("Database query is empty.");
        }

        String normalizedQuery = normalizeSql(query);
        String firstKeyword = firstKeyword(normalizedQuery);

        if (!operation.equals(firstKeyword)) {
            throw new IllegalArgumentException(
                    capitalize(operation) + " operation requires " + operation.toUpperCase(Locale.ROOT) + " query."
            );
        }

        if (!allowDangerousSql) {
            validateSafeSql(normalizedQuery);
        }
    }

    private void validateSafeSql(String normalizedQuery) {
        if (normalizedQuery.contains(";")) {
            throw new IllegalArgumentException(
                    "Multiple SQL statements are not allowed in database block."
            );
        }

        for (String keyword : DANGEROUS_KEYWORDS) {
            if (containsKeyword(normalizedQuery, keyword)) {
                throw new IllegalArgumentException(
                        "Dangerous SQL keyword is not allowed in database block: " + keyword
                );
            }
        }

        assertNotSystemSchemaReference(normalizedQuery);
    }

    private String normalizeSql(String query) {
        String withoutComments = SQL_COMMENT_PATTERN.matcher(query).replaceAll(" ");
        return withoutComments
                .replaceAll("\\s+", " ")
                .trim()
                .toLowerCase(Locale.ROOT);
    }

    private String firstKeyword(String normalizedQuery) {
        if (normalizedQuery == null || normalizedQuery.isBlank()) {
            return "";
        }

        int firstSpaceIndex = normalizedQuery.indexOf(' ');
        return firstSpaceIndex < 0
                ? normalizedQuery
                : normalizedQuery.substring(0, firstSpaceIndex);
    }

    private boolean containsKeyword(String normalizedQuery, String keyword) {
        return Pattern.compile("(^|[^a-zA-Z0-9_])" + Pattern.quote(keyword) + "([^a-zA-Z0-9_]|$)")
                .matcher(normalizedQuery)
                .find();
    }

    private void assertNotSystemSchemaReference(String value) {
        for (String prefix : SYSTEM_SCHEMA_PREFIXES) {
            if (value.contains(prefix)) {
                throw new IllegalArgumentException(
                        "Database block cannot access system schema: " + prefix.substring(0, prefix.length() - 1)
                );
            }
        }
    }

    private String applyLimitIfNeeded(String query) {
        String normalizedQuery = normalizeSql(query);

        if (normalizedQuery.matches("(?s).*\\blimit\\s+\\d+.*")) {
            return query;
        }

        return query + " LIMIT " + maxSelectRows;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toParameterMap(Object value) {
        if (value == null) {
            return Map.of();
        }

        if (value instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }

        if (value instanceof String raw && jsonHelper.looksLikeJson(raw)) {
            Object parsed = jsonHelper.toObject(raw);

            if (parsed instanceof Map<?, ?> parsedMap) {
                return (Map<String, Object>) parsedMap;
            }
        }

        return Map.of("value", value);
    }

    private String capitalize(String value) {
        if (value == null || value.isBlank()) {
            return "Database";
        }

        return value.substring(0, 1).toUpperCase(Locale.ROOT) + value.substring(1);
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

package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

@Component
public class DatabaseNodeHandler implements NodeHandler {

    private static final Pattern SAFE_TABLE_NAME_PATTERN = Pattern.compile(
            "^[a-zA-Z_][a-zA-Z0-9_]*(\\.[a-zA-Z_][a-zA-Z0-9_]*)?$"
    );

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final JsonHelper jsonHelper;
    private final boolean writeEnabled;
    private final boolean allowDangerousSql;
    private final int maxSelectRows;

    public DatabaseNodeHandler(
            NamedParameterJdbcTemplate jdbcTemplate,
            JsonHelper jsonHelper,
            @Value("${flowact.database-block.write-enabled:false}") boolean writeEnabled,
            @Value("${flowact.database-block.allow-dangerous-sql:false}") boolean allowDangerousSql,
            @Value("${flowact.database-block.max-select-rows:100}") int maxSelectRows
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.jsonHelper = jsonHelper;
        this.writeEnabled = writeEnabled;
        this.allowDangerousSql = allowDangerousSql;
        this.maxSelectRows = maxSelectRows;
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

        String operation = getString(config, "operation", "select").toLowerCase(Locale.ROOT);
        String tableName = getString(config, "tableName", "");
        String query = getString(config, "query", "").trim();

        Map<String, Object> params = toParameterMap(config.get("payload"));

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
                    "Database write operations are disabled. " +
                            "Set FLOWACT_DATABASE_BLOCK_WRITE_ENABLED=true to enable them."
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

        if (!SAFE_TABLE_NAME_PATTERN.matcher(tableName).matches()) {
            throw new IllegalArgumentException(
                    "Invalid tableName. Only simple table names are allowed."
            );
        }

        if ("select".equals(operation)) {
            return "SELECT * FROM " + tableName;
        }

        throw new IllegalArgumentException(
                "Query is required for operation: " + operation
        );
    }

    private void validateQuery(String operation, String query) {
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("Database query is empty.");
        }

        String normalizedQuery = query.trim().toLowerCase(Locale.ROOT);

        if (!allowDangerousSql && normalizedQuery.contains(";")) {
            throw new IllegalArgumentException(
                    "Multiple SQL statements are not allowed in database block."
            );
        }

        if (
                !allowDangerousSql &&
                        (
                                normalizedQuery.contains(" drop ") ||
                                        normalizedQuery.startsWith("drop ") ||
                                        normalizedQuery.contains(" truncate ") ||
                                        normalizedQuery.startsWith("truncate ") ||
                                        normalizedQuery.contains(" alter ") ||
                                        normalizedQuery.startsWith("alter ") ||
                                        normalizedQuery.contains(" create ") ||
                                        normalizedQuery.startsWith("create ") ||
                                        normalizedQuery.contains(" grant ") ||
                                        normalizedQuery.startsWith("grant ") ||
                                        normalizedQuery.contains(" revoke ") ||
                                        normalizedQuery.startsWith("revoke ")
                        )
        ) {
            throw new IllegalArgumentException(
                    "Dangerous SQL statement is not allowed in database block."
            );
        }

        if ("select".equals(operation) && !normalizedQuery.startsWith("select")) {
            throw new IllegalArgumentException(
                    "Select operation requires SELECT query."
            );
        }

        if ("insert".equals(operation) && !normalizedQuery.startsWith("insert")) {
            throw new IllegalArgumentException(
                    "Insert operation requires INSERT query."
            );
        }

        if ("update".equals(operation) && !normalizedQuery.startsWith("update")) {
            throw new IllegalArgumentException(
                    "Update operation requires UPDATE query."
            );
        }

        if ("delete".equals(operation) && !normalizedQuery.startsWith("delete")) {
            throw new IllegalArgumentException(
                    "Delete operation requires DELETE query."
            );
        }

        if (
                !"select".equals(operation) &&
                        !"insert".equals(operation) &&
                        !"update".equals(operation) &&
                        !"delete".equals(operation)
        ) {
            throw new IllegalArgumentException(
                    "Unsupported database operation: " + operation
            );
        }
    }

    private String applyLimitIfNeeded(String query) {
        String normalizedQuery = query.toLowerCase(Locale.ROOT);

        if (normalizedQuery.matches("(?s).*\\blimit\\s+\\d+.*")) {
            return query;
        }

        return query + " LIMIT " + Math.max(1, maxSelectRows);
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

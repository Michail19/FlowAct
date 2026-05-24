package com.ms.workerservice.execution.engine.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.execution.engine.TemplateRenderer;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DatabaseNodeHandlerTest {

    private NamedParameterJdbcTemplate jdbcTemplate;
    private DatabaseNodeHandler handler;

    @BeforeEach
    void setUp() {
        jdbcTemplate = mock(NamedParameterJdbcTemplate.class);
        JsonHelper jsonHelper = new JsonHelper(new ObjectMapper());

        handler = new DatabaseNodeHandler(
                jdbcTemplate,
                jsonHelper,
                new TemplateRenderer(jsonHelper),
                false,
                false,
                25
        );
    }

    @Test
    void handleSelectRendersQueryAndPayloadFromInputAndAddsLimit() {
        when(jdbcTemplate.queryForList(anyString(), anyMap()))
                .thenReturn(List.of(Map.of("id", 1, "email", "user@example.com")));

        ResolvedInput input = new ResolvedInput(Map.of(
                "input", Map.of("email", "user@example.com"),
                "value", Map.of("email", "user@example.com"),
                "inputs", Map.of(),
                "variables", Map.of()
        ));

        WorkflowBlockEntity block = block("""
                {
                  "operation": "select",
                  "query": "SELECT * FROM users WHERE email = :email",
                  "payload": {
                    "email": "{{input.email}}"
                  }
                }
                """);

        NodeResult result = handler.handle(
                block,
                input,
                new ExecutionContext(UUID.randomUUID(), UUID.randomUUID(), Map.of("email", "user@example.com"))
        );

        @SuppressWarnings("unchecked")
        Map<String, Object> output = (Map<String, Object>) result.getOutput();

        assertThat(output)
                .containsEntry("count", 1);

        ArgumentCaptor<String> queryCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Map<String, Object>> paramsCaptor = ArgumentCaptor.forClass(Map.class);
        verify(jdbcTemplate).queryForList(queryCaptor.capture(), paramsCaptor.capture());

        assertThat(queryCaptor.getValue())
                .isEqualTo("SELECT * FROM users WHERE email = :email LIMIT 25");
        assertThat(paramsCaptor.getValue())
                .containsEntry("email", "user@example.com");
    }

    @Test
    void handleRejectsMultipleSqlStatements() {
        assertThatThrownBy(() -> handler.handle(
                block("""
                        {
                          "operation": "select",
                          "query": "SELECT * FROM users; DROP TABLE users"
                        }
                        """),
                emptyInput(),
                new ExecutionContext(UUID.randomUUID(), UUID.randomUUID(), Map.of())
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Multiple SQL statements are not allowed");
    }

    @Test
    void handleRejectsDangerousSqlKeywordEvenWhenCommentedAround() {
        assertThatThrownBy(() -> handler.handle(
                block("""
                        {
                          "operation": "select",
                          "query": "SELECT * FROM users /* hidden */ DROP TABLE users"
                        }
                        """),
                emptyInput(),
                new ExecutionContext(UUID.randomUUID(), UUID.randomUUID(), Map.of())
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Dangerous SQL keyword is not allowed");
    }

    @Test
    void handleRejectsSystemSchemaAccess() {
        assertThatThrownBy(() -> handler.handle(
                block("""
                        {
                          "operation": "select",
                          "query": "SELECT * FROM information_schema.tables"
                        }
                        """),
                emptyInput(),
                new ExecutionContext(UUID.randomUUID(), UUID.randomUUID(), Map.of())
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot access system schema");
    }

    @Test
    void handleRejectsWriteOperationWhenWritesAreDisabled() {
        assertThatThrownBy(() -> handler.handle(
                block("""
                        {
                          "operation": "update",
                          "query": "UPDATE users SET name = :name WHERE id = :id",
                          "payload": {
                            "id": 1,
                            "name": "Mikhail"
                          }
                        }
                        """),
                emptyInput(),
                new ExecutionContext(UUID.randomUUID(), UUID.randomUUID(), Map.of())
        ))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Database write operations are disabled");
    }

    private ResolvedInput emptyInput() {
        return new ResolvedInput(Map.of(
                "inputs", Map.of(),
                "variables", Map.of()
        ));
    }

    private WorkflowBlockEntity block(String config) {
        return WorkflowBlockEntity.builder()
                .id(UUID.randomUUID())
                .type(BlockType.DATABASE_QUERY)
                .name("Database")
                .config(config)
                .position("{}")
                .build();
    }
}

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
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EmailNodeHandlerTest {

    private ObjectProvider<JavaMailSender> mailSenderProvider;
    private JavaMailSender mailSender;
    private JsonHelper jsonHelper;
    private EmailNodeHandler handler;

    @BeforeEach
    void setUp() {
        mailSenderProvider = mock(ObjectProvider.class);
        mailSender = mock(JavaMailSender.class);
        jsonHelper = new JsonHelper(new ObjectMapper());
        TemplateRenderer templateRenderer = new TemplateRenderer(jsonHelper);

        handler = new EmailNodeHandler(
                mailSenderProvider,
                jsonHelper,
                templateRenderer,
                true,
                "noreply@flowact.local",
                3,
                200,
                10_000
        );
    }

    @Test
    void handleRendersInputAndLastTemplatesAndSendsEmail() {
        when(mailSenderProvider.getIfAvailable()).thenReturn(mailSender);

        ExecutionContext context = new ExecutionContext(
                UUID.randomUUID(),
                UUID.randomUUID(),
                Map.of("email", "user@example.com", "name", "Mikhail")
        );
        context.setLastSuccessfulOutput(Map.of("text", "done"));

        ResolvedInput input = new ResolvedInput(Map.of(
                "input", Map.of("email", "user@example.com", "name", "Mikhail"),
                "value", Map.of("email", "user@example.com", "name", "Mikhail"),
                "last", Map.of("text", "done"),
                "output", Map.of("text", "done"),
                "inputs", Map.of(),
                "variables", Map.of()
        ));

        WorkflowBlockEntity block = block("""
                {
                  "recipient": "{{input.email}}",
                  "subject": "Hello {{input.name}}",
                  "body": "Result: {{last.text}}"
                }
                """);

        NodeResult result = handler.handle(block, input, context);

        assertThat(result.getOutput()).isInstanceOf(Map.class);

        @SuppressWarnings("unchecked")
        Map<String, Object> output = (Map<String, Object>) result.getOutput();

        assertThat(output)
                .containsEntry("sent", true)
                .containsEntry("preview", false)
                .containsEntry("from", "noreply@flowact.local");

        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(captor.capture());

        SimpleMailMessage message = captor.getValue();
        assertThat(message.getTo()).containsExactly("user@example.com");
        assertThat(message.getSubject()).isEqualTo("Hello Mikhail");
        assertThat(message.getText()).isEqualTo("Result: done");
    }

    @Test
    void handleReturnsPreviewWhenEmailSendingIsDisabled() {
        EmailNodeHandler previewHandler = new EmailNodeHandler(
                mailSenderProvider,
                jsonHelper,
                new TemplateRenderer(jsonHelper),
                false,
                "noreply@flowact.local",
                3,
                200,
                10_000
        );

        when(mailSenderProvider.getIfAvailable()).thenReturn(null);

        NodeResult result = previewHandler.handle(
                block("""
                        {
                          "recipient": "user@example.com",
                          "subject": "Preview",
                          "body": "Body"
                        }
                        """),
                new ResolvedInput(Map.of("inputs", Map.of(), "variables", Map.of())),
                new ExecutionContext(UUID.randomUUID(), UUID.randomUUID(), Map.of())
        );

        @SuppressWarnings("unchecked")
        Map<String, Object> output = (Map<String, Object>) result.getOutput();

        assertThat(output)
                .containsEntry("sent", false)
                .containsEntry("preview", true);
    }

    @Test
    void handleRejectsDisplayNameAddress() {
        assertThatThrownBy(() -> handler.handle(
                block("""
                        {
                          "recipient": "User <user@example.com>",
                          "subject": "Hello",
                          "body": "Body"
                        }
                        """),
                new ResolvedInput(Map.of("inputs", Map.of(), "variables", Map.of())),
                new ExecutionContext(UUID.randomUUID(), UUID.randomUUID(), Map.of())
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("must be a plain address");
    }

    @Test
    void handleRejectsHeaderInjectionInSubject() {
        assertThatThrownBy(() -> handler.handle(
                block("""
                        {
                          "recipient": "user@example.com",
                          "subject": "Hello\nBCC: attacker@example.com",
                          "body": "Body"
                        }
                        """),
                new ResolvedInput(Map.of("inputs", Map.of(), "variables", Map.of())),
                new ExecutionContext(UUID.randomUUID(), UUID.randomUUID(), Map.of())
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("must not contain line breaks");
    }

    @Test
    void handleRejectsTooManyRecipients() {
        assertThatThrownBy(() -> handler.handle(
                block("""
                        {
                          "recipient": "a@example.com,b@example.com,c@example.com,d@example.com",
                          "subject": "Hello",
                          "body": "Body"
                        }
                        """),
                new ResolvedInput(Map.of("inputs", Map.of(), "variables", Map.of())),
                new ExecutionContext(UUID.randomUUID(), UUID.randomUUID(), Map.of())
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("recipient count exceeds limit");
    }

    private WorkflowBlockEntity block(String config) {
        return WorkflowBlockEntity.builder()
                .id(UUID.randomUUID())
                .type(BlockType.EMAIL_SEND)
                .name("Email")
                .config(config)
                .position("{}")
                .build();
    }
}

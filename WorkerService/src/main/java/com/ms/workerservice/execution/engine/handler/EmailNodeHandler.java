package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class EmailNodeHandler implements NodeHandler {

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final JsonHelper jsonHelper;
    private final boolean emailEnabled;
    private final String defaultFrom;

    public EmailNodeHandler(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            JsonHelper jsonHelper,
            @Value("${flowact.email.enabled:false}") boolean emailEnabled,
            @Value("${flowact.email.default-from:noreply@flowact.local}") String defaultFrom
    ) {
        this.mailSenderProvider = mailSenderProvider;
        this.jsonHelper = jsonHelper;
        this.emailEnabled = emailEnabled;
        this.defaultFrom = defaultFrom;
    }

    @Override
    public BlockType getSupportedType() {
        return BlockType.EMAIL_SEND;
    }

    @Override
    public NodeResult handle(
            WorkflowBlockEntity block,
            ResolvedInput input,
            ExecutionContext context
    ) {
        Map<String, Object> config = jsonHelper.toMap(block.getConfig());

        String recipient = getString(config, "recipient", "").trim();
        String subject = renderTemplate(
                getString(config, "subject", "FlowAct notification"),
                input,
                context
        );
        String body = renderTemplate(
                getString(config, "body", ""),
                input,
                context
        );

        if (recipient.isBlank()) {
            throw new IllegalArgumentException("Email recipient is empty.");
        }

        String[] recipients = splitRecipients(recipient);

        Map<String, Object> output = new LinkedHashMap<>();
        output.put("to", Arrays.asList(recipients));
        output.put("subject", subject);
        output.put("body", body);

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();

        if (!emailEnabled || mailSender == null) {
            output.put("sent", false);
            output.put("preview", true);
            output.put(
                    "reason",
                    "Email sending is disabled. Set FLOWACT_EMAIL_ENABLED=true and configure SMTP."
            );

            return NodeResult.of(output);
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(defaultFrom);
        message.setTo(recipients);
        message.setSubject(subject);
        message.setText(body);

        mailSender.send(message);

        output.put("sent", true);
        output.put("preview", false);
        output.put("from", defaultFrom);

        return NodeResult.of(output);
    }

    private String[] splitRecipients(String recipient) {
        return Arrays.stream(recipient.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .toArray(String[]::new);
    }

    private String renderTemplate(
            String template,
            ResolvedInput input,
            ExecutionContext context
    ) {
        if (template == null) {
            return "";
        }

        Object inputValue = input.getValue() != null
                ? input.getValue()
                : input.getValues();

        String inputJson = jsonHelper.toJson(inputValue);
        String variablesJson = jsonHelper.toJson(context.getVariables());
        String lastJson = jsonHelper.toJson(context.getLastSuccessfulOutput());

        return template
                .replace("{{input}}", inputJson != null ? inputJson : "")
                .replace("{{last}}", lastJson != null ? lastJson : "")
                .replace("{{variables}}", variablesJson != null ? variablesJson : "");
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

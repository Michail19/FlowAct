package com.ms.workerservice.execution.engine.handler;

import com.ms.workerservice.common.util.JsonHelper;
import com.ms.workerservice.execution.engine.ExecutionContext;
import com.ms.workerservice.execution.engine.NodeResult;
import com.ms.workerservice.execution.engine.ResolvedInput;
import com.ms.workerservice.execution.engine.TemplateRenderer;
import com.ms.workerservice.workflow.entity.WorkflowBlockEntity;
import com.ms.workerservice.workflow.enumtype.BlockType;
import jakarta.mail.internet.AddressException;
import jakarta.mail.internet.InternetAddress;
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
    private final TemplateRenderer templateRenderer;
    private final boolean emailEnabled;
    private final String defaultFrom;
    private final int maxRecipients;
    private final int maxSubjectLength;
    private final int maxBodyLength;

    public EmailNodeHandler(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            JsonHelper jsonHelper,
            TemplateRenderer templateRenderer,
            @Value("${flowact.email.enabled:false}") boolean emailEnabled,
            @Value("${flowact.email.default-from:noreply@flowact.local}") String defaultFrom,
            @Value("${flowact.email.max-recipients:10}") int maxRecipients,
            @Value("${flowact.email.max-subject-length:200}") int maxSubjectLength,
            @Value("${flowact.email.max-body-length:10000}") int maxBodyLength
    ) {
        this.mailSenderProvider = mailSenderProvider;
        this.jsonHelper = jsonHelper;
        this.templateRenderer = templateRenderer;
        this.emailEnabled = emailEnabled;
        this.defaultFrom = defaultFrom;
        this.maxRecipients = Math.max(1, maxRecipients);
        this.maxSubjectLength = Math.max(1, maxSubjectLength);
        this.maxBodyLength = Math.max(1, maxBodyLength);
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

        String recipient = templateRenderer.render(getString(config, "recipient", ""), input, context).trim();
        String subject = templateRenderer.render(
                getString(config, "subject", "FlowAct notification"),
                input,
                context
        );
        String body = templateRenderer.render(
                getString(config, "body", ""),
                input,
                context
        );

        validateHeaderSafe("subject", subject);
        validateHeaderSafe("defaultFrom", defaultFrom);
        validateLength("Email subject", subject, maxSubjectLength);
        validateLength("Email body", body, maxBodyLength);

        if (recipient.isBlank()) {
            throw new IllegalArgumentException("Email recipient is empty.");
        }

        String[] recipients = splitRecipients(recipient);
        validateRecipients(recipients);
        validateEmailAddress(defaultFrom, "defaultFrom");

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
                .distinct()
                .toArray(String[]::new);
    }

    private void validateRecipients(String[] recipients) {
        if (recipients.length == 0) {
            throw new IllegalArgumentException("Email recipient is empty.");
        }

        if (recipients.length > maxRecipients) {
            throw new IllegalArgumentException(
                    "Email recipient count exceeds limit: " + recipients.length + " > " + maxRecipients
            );
        }

        for (String recipient : recipients) {
            validateHeaderSafe("recipient", recipient);
            validateEmailAddress(recipient, "recipient");
        }
    }

    private void validateEmailAddress(String email, String fieldName) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Email " + fieldName + " is empty.");
        }

        try {
            InternetAddress address = new InternetAddress(email, true);
            address.validate();

            if (!email.equals(address.getAddress())) {
                throw new IllegalArgumentException("Email " + fieldName + " must be a plain address: " + email);
            }
        } catch (AddressException ex) {
            throw new IllegalArgumentException("Invalid email " + fieldName + ": " + email, ex);
        }
    }

    private void validateHeaderSafe(String fieldName, String value) {
        if (value == null) {
            return;
        }

        if (value.contains("\r") || value.contains("\n")) {
            throw new IllegalArgumentException(
                    "Email " + fieldName + " must not contain line breaks."
            );
        }
    }

    private void validateLength(String fieldName, String value, int maxLength) {
        if (value != null && value.length() > maxLength) {
            throw new IllegalArgumentException(
                    fieldName + " exceeds limit: " + value.length() + " > " + maxLength
            );
        }
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

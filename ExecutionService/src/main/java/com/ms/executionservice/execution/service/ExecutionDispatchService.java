package com.ms.executionservice.execution.service;

import com.ms.executionservice.config.properties.ExecutionKafkaProperties;
import com.ms.executionservice.execution.dto.event.ExecutionCancelRequestedEvent;
import com.ms.executionservice.execution.dto.event.ExecutionRetryRequestedEvent;
import com.ms.executionservice.execution.dto.event.ExecutionRunRequestedEvent;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class ExecutionDispatchService {

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ExecutionKafkaProperties executionKafkaProperties;

    public ExecutionDispatchService(
            KafkaTemplate<String, Object> kafkaTemplate,
            ExecutionKafkaProperties executionKafkaProperties
    ) {
        this.kafkaTemplate = kafkaTemplate;
        this.executionKafkaProperties = executionKafkaProperties;
    }

    public void publishRunRequested(
            UUID executionId,
            UUID workflowId,
            UUID notebookId,
            UUID startedByUserId
    ) {
        ExecutionRunRequestedEvent event = ExecutionRunRequestedEvent.builder()
                .eventId(UUID.randomUUID())
                .eventType("EXECUTION_RUN_REQUESTED")
                .executionId(executionId)
                .workflowId(workflowId)
                .notebookId(notebookId)
                .startedByUserId(startedByUserId)
                .triggerType("MANUAL")
                .createdAt(OffsetDateTime.now())
                .build();

        kafkaTemplate.send(
                executionKafkaProperties.runRequestedTopic(),
                executionId.toString(),
                event
        );
    }

    public void publishRetryRequested(
            UUID sourceExecutionId,
            UUID executionId,
            UUID workflowId,
            UUID notebookId,
            UUID startedByUserId
    ) {
        ExecutionRetryRequestedEvent event = ExecutionRetryRequestedEvent.builder()
                .eventId(UUID.randomUUID())
                .eventType("EXECUTION_RETRY_REQUESTED")
                .sourceExecutionId(sourceExecutionId)
                .executionId(executionId)
                .workflowId(workflowId)
                .notebookId(notebookId)
                .startedByUserId(startedByUserId)
                .triggerType("RETRY")
                .createdAt(OffsetDateTime.now())
                .build();

        kafkaTemplate.send(
                executionKafkaProperties.retryRequestedTopic(),
                executionId.toString(),
                event
        );
    }

    public void publishCancelRequested(
            UUID executionId,
            UUID workflowId,
            UUID notebookId
    ) {
        ExecutionCancelRequestedEvent event = ExecutionCancelRequestedEvent.builder()
                .eventId(UUID.randomUUID())
                .eventType("EXECUTION_CANCEL_REQUESTED")
                .executionId(executionId)
                .workflowId(workflowId)
                .notebookId(notebookId)
                .createdAt(OffsetDateTime.now())
                .build();

        kafkaTemplate.send(
                executionKafkaProperties.cancelRequestedTopic(),
                executionId.toString(),
                event
        );
    }
}

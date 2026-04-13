package com.ms.executionservice.execution.service;

import com.ms.executionservice.config.properties.ExecutionKafkaProperties;
import com.ms.executionservice.execution.event.ExecutionRunRequestedEvent;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class ExecutionDispatchService {

    private static final String EVENT_TYPE = "EXECUTION_RUN_REQUESTED";
    private static final String TRIGGER_TYPE = "MANUAL";

    private final KafkaTemplate<String, ExecutionRunRequestedEvent> kafkaTemplate;
    private final ExecutionKafkaProperties executionKafkaProperties;

    public ExecutionDispatchService(
            KafkaTemplate<String, ExecutionRunRequestedEvent> kafkaTemplate,
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
                .eventType(EVENT_TYPE)
                .executionId(executionId)
                .workflowId(workflowId)
                .notebookId(notebookId)
                .startedByUserId(startedByUserId)
                .triggerType(TRIGGER_TYPE)
                .createdAt(OffsetDateTime.now())
                .build();

        kafkaTemplate.send(
                executionKafkaProperties.runRequestedTopic(),
                executionId.toString(),
                event
        );
    }
}

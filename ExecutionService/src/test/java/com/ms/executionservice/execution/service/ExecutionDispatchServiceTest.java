package com.ms.executionservice.execution.service;

import com.ms.executionservice.config.properties.ExecutionKafkaProperties;
import com.ms.executionservice.execution.dto.event.ExecutionCancelRequestedEvent;
import com.ms.executionservice.execution.dto.event.ExecutionResumeRequestedEvent;
import com.ms.executionservice.execution.dto.event.ExecutionRetryRequestedEvent;
import com.ms.executionservice.execution.dto.event.ExecutionRunRequestedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ExecutionDispatchServiceTest {

    private KafkaTemplate<String, Object> kafkaTemplate;
    private ExecutionDispatchService executionDispatchService;

    @BeforeEach
    void setUp() {
        kafkaTemplate = mock(KafkaTemplate.class);

        ExecutionKafkaProperties properties = new ExecutionKafkaProperties(
                "topic.run",
                "topic.retry",
                "topic.cancel",
                "topic.resume"
        );

        executionDispatchService = new ExecutionDispatchService(
                kafkaTemplate,
                properties
        );
    }

    @Test
    void publishRunRequested_shouldSendRunEventToRunTopic() {
        UUID executionId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID notebookId = UUID.randomUUID();
        UUID startedByUserId = UUID.randomUUID();

        executionDispatchService.publishRunRequested(
                executionId,
                workflowId,
                notebookId,
                startedByUserId
        );

        ArgumentCaptor<Object> eventCaptor = ArgumentCaptor.forClass(Object.class);

        verify(kafkaTemplate).send(
                eq("topic.run"),
                eq(executionId.toString()),
                eventCaptor.capture()
        );

        assertInstanceOf(ExecutionRunRequestedEvent.class, eventCaptor.getValue());

        ExecutionRunRequestedEvent event = (ExecutionRunRequestedEvent) eventCaptor.getValue();
        assertEquals("EXECUTION_RUN_REQUESTED", event.eventType());
        assertEquals(executionId, event.executionId());
        assertEquals(workflowId, event.workflowId());
        assertEquals(notebookId, event.notebookId());
        assertEquals(startedByUserId, event.startedByUserId());
        assertEquals("MANUAL", event.triggerType());
        assertNotNull(event.eventId());
        assertNotNull(event.createdAt());
    }

    @Test
    void publishRetryRequested_shouldSendRetryEventToRetryTopic() {
        UUID sourceExecutionId = UUID.randomUUID();
        UUID executionId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID notebookId = UUID.randomUUID();
        UUID startedByUserId = UUID.randomUUID();

        executionDispatchService.publishRetryRequested(
                sourceExecutionId,
                executionId,
                workflowId,
                notebookId,
                startedByUserId
        );

        ArgumentCaptor<Object> eventCaptor = ArgumentCaptor.forClass(Object.class);

        verify(kafkaTemplate).send(
                eq("topic.retry"),
                eq(executionId.toString()),
                eventCaptor.capture()
        );

        assertInstanceOf(ExecutionRetryRequestedEvent.class, eventCaptor.getValue());

        ExecutionRetryRequestedEvent event = (ExecutionRetryRequestedEvent) eventCaptor.getValue();
        assertEquals("EXECUTION_RETRY_REQUESTED", event.eventType());
        assertEquals(sourceExecutionId, event.sourceExecutionId());
        assertEquals(executionId, event.executionId());
        assertEquals(workflowId, event.workflowId());
        assertEquals(notebookId, event.notebookId());
        assertEquals(startedByUserId, event.startedByUserId());
        assertEquals("RETRY", event.triggerType());
        assertNotNull(event.eventId());
        assertNotNull(event.createdAt());
    }

    @Test
    void publishCancelRequested_shouldSendCancelEventToCancelTopic() {
        UUID executionId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID notebookId = UUID.randomUUID();

        executionDispatchService.publishCancelRequested(
                executionId,
                workflowId,
                notebookId
        );

        ArgumentCaptor<Object> eventCaptor = ArgumentCaptor.forClass(Object.class);

        verify(kafkaTemplate).send(
                eq("topic.cancel"),
                eq(executionId.toString()),
                eventCaptor.capture()
        );

        assertInstanceOf(ExecutionCancelRequestedEvent.class, eventCaptor.getValue());

        ExecutionCancelRequestedEvent event = (ExecutionCancelRequestedEvent) eventCaptor.getValue();
        assertEquals("EXECUTION_CANCEL_REQUESTED", event.eventType());
        assertEquals(executionId, event.executionId());
        assertEquals(workflowId, event.workflowId());
        assertEquals(notebookId, event.notebookId());
        assertNotNull(event.eventId());
        assertNotNull(event.createdAt());
    }

    @Test
    void publishResumeRequested_shouldSendResumeEventToResumeTopic() {
        UUID executionId = UUID.randomUUID();
        UUID workflowId = UUID.randomUUID();
        UUID notebookId = UUID.randomUUID();
        Object resumePayload = Map.of("approved", true);

        executionDispatchService.publishResumeRequested(
                executionId,
                workflowId,
                notebookId,
                resumePayload
        );

        ArgumentCaptor<Object> eventCaptor = ArgumentCaptor.forClass(Object.class);

        verify(kafkaTemplate).send(
                eq("topic.resume"),
                eq(executionId.toString()),
                eventCaptor.capture()
        );

        assertInstanceOf(ExecutionResumeRequestedEvent.class, eventCaptor.getValue());

        ExecutionResumeRequestedEvent event = (ExecutionResumeRequestedEvent) eventCaptor.getValue();
        assertEquals("EXECUTION_RESUME_REQUESTED", event.eventType());
        assertEquals(executionId, event.executionId());
        assertEquals(workflowId, event.workflowId());
        assertEquals(notebookId, event.notebookId());
        assertEquals(resumePayload, event.resumePayload());
        assertNotNull(event.eventId());
        assertNotNull(event.createdAt());
    }
}

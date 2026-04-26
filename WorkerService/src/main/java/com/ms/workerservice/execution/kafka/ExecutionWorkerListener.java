package com.ms.workerservice.execution.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ms.workerservice.execution.event.ExecutionCancelRequestedEvent;
import com.ms.workerservice.execution.event.ExecutionResumeRequestedEvent;
import com.ms.workerservice.execution.event.ExecutionRetryRequestedEvent;
import com.ms.workerservice.execution.event.ExecutionRunRequestedEvent;
import com.ms.workerservice.execution.service.ExecutionWorkerService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class ExecutionWorkerListener {

    private final ExecutionWorkerService executionWorkerService;
    private final ObjectMapper objectMapper;

    public ExecutionWorkerListener(
            ExecutionWorkerService executionWorkerService,
            ObjectMapper objectMapper
    ) {
        this.executionWorkerService = executionWorkerService;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(
            topics = "${flowact.kafka.execution.run-requested-topic}",
            groupId = "${flowact.kafka.execution.run-requested-group-id}"
    )
    public void onExecutionRunRequested(String payload) throws Exception {
        ExecutionRunRequestedEvent event = objectMapper.readValue(payload, ExecutionRunRequestedEvent.class);
        executionWorkerService.handleRunRequested(event);
    }

    @KafkaListener(
            topics = "${flowact.kafka.execution.retry-requested-topic}",
            groupId = "${flowact.kafka.execution.retry-requested-group-id}"
    )
    public void onExecutionRetryRequested(String payload) throws Exception {
        ExecutionRetryRequestedEvent event = objectMapper.readValue(payload, ExecutionRetryRequestedEvent.class);
        executionWorkerService.handleRetryRequested(event);
    }

    @KafkaListener(
            topics = "${flowact.kafka.execution.cancel-requested-topic}",
            groupId = "${flowact.kafka.execution.cancel-requested-group-id}"
    )
    public void onExecutionCancelRequested(String payload) throws Exception {
        ExecutionCancelRequestedEvent event = objectMapper.readValue(payload, ExecutionCancelRequestedEvent.class);
        executionWorkerService.handleCancelRequested(event);
    }

    @KafkaListener(
            topics = "${flowact.kafka.execution.resume-requested-topic}",
            groupId = "${flowact.kafka.execution.resume-requested-group-id}"
    )
    public void onExecutionResumeRequested(String payload) throws Exception {
        ExecutionResumeRequestedEvent event = objectMapper.readValue(payload, ExecutionResumeRequestedEvent.class);
        executionWorkerService.handleResumeRequested(event);
    }
}

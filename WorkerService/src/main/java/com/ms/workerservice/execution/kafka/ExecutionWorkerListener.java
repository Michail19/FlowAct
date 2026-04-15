package com.ms.workerservice.execution.kafka;

import com.ms.workerservice.execution.event.ExecutionRunRequestedEvent;
import com.ms.workerservice.execution.service.ExecutionWorkerService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class ExecutionWorkerListener {

    private final ExecutionWorkerService executionWorkerService;

    public ExecutionWorkerListener(ExecutionWorkerService executionWorkerService) {
        this.executionWorkerService = executionWorkerService;
    }

    @KafkaListener(
            topics = "${flowact.kafka.execution.run-requested-topic}",
            groupId = "${flowact.kafka.execution.run-requested-group-id}"
    )
    public void onExecutionRunRequested(ExecutionRunRequestedEvent event) {
        executionWorkerService.handleRunRequested(event);
    }
}

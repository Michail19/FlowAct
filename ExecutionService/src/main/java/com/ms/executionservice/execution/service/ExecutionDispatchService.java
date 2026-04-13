package com.ms.executionservice.execution.service;

import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class ExecutionDispatchService {

    public void publishRunRequested(
            UUID executionId,
            UUID workflowId,
            UUID notebookId,
            UUID startedByUserId
    ) {
        // TODO: publish EXECUTION_RUN_REQUESTED event to Kafka
    }
}

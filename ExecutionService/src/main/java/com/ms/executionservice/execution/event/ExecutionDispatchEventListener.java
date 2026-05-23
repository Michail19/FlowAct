package com.ms.executionservice.execution.event;

import com.ms.executionservice.execution.service.ExecutionDispatchService;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class ExecutionDispatchEventListener {

    private final ExecutionDispatchService executionDispatchService;

    public ExecutionDispatchEventListener(ExecutionDispatchService executionDispatchService) {
        this.executionDispatchService = executionDispatchService;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onRunRequested(ExecutionRunDispatchEvent event) {
        executionDispatchService.publishRunRequested(
                event.executionId(),
                event.workflowId(),
                event.notebookId(),
                event.startedByUserId()
        );
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onRetryRequested(ExecutionRetryDispatchEvent event) {
        executionDispatchService.publishRetryRequested(
                event.sourceExecutionId(),
                event.executionId(),
                event.workflowId(),
                event.notebookId(),
                event.startedByUserId()
        );
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onResumeRequested(ExecutionResumeDispatchEvent event) {
        executionDispatchService.publishResumeRequested(
                event.executionId(),
                event.workflowId(),
                event.notebookId(),
                event.resumePayload()
        );
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCancelRequested(ExecutionCancelDispatchEvent event) {
        executionDispatchService.publishCancelRequested(
                event.executionId(),
                event.workflowId(),
                event.notebookId()
        );
    }
}

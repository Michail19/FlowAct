package com.ms.workerservice.execution.engine;

import lombok.Builder;

@Builder
public record WaitState(
        String waitType,
        String resumeKey,
        String waitingBlockId,
        Object input
) {
}

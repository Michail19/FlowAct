package com.ms.executionservice.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "flowact.execution")
public record FlowActExecutionProperties(
        int maxDepth,
        int defaultPageSize,
        int maxPageSize
) {
}

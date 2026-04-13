package com.ms.executionservice.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "flowact.kafka.execution")
public record ExecutionKafkaProperties(
        String runRequestedTopic,
        String retryRequestedTopic,
        String cancelRequestedTopic
) {
}

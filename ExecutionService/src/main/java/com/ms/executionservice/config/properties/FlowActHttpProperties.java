package com.ms.executionservice.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "flowact.http")
public record FlowActHttpProperties(
        int connectTimeout,
        int readTimeout
) {
}

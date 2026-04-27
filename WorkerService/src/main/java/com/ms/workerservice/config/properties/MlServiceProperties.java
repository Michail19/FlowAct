package com.ms.workerservice.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "flowact.ml")
public record MlServiceProperties(
        String baseUrl,
        String predictPath
) {
}

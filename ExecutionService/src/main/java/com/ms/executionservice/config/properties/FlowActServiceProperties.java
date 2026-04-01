package com.ms.executionservice.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "flowact.services")
public record FlowActServiceProperties(
        ServiceEndpoint auth,
        ServiceEndpoint ml,
        ServiceEndpoint gateway,
        ServiceEndpoint schedule
) {

    public record ServiceEndpoint(
            String baseUrl
    ) {
    }
}

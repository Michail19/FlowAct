package com.ms.workerservice.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "flowact.llm.openrouter")
public record OpenRouterProperties(
        String baseUrl,
        String chatPath,
        String apiKey,
        String defaultModel,
        String siteUrl,
        String appName,
        Boolean allowPaidModels
) {
    public boolean isPaidModelAllowed() {
        return Boolean.TRUE.equals(allowPaidModels);
    }
}

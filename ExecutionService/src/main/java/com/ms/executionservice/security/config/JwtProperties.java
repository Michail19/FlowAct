package com.ms.executionservice.security.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "flowact.security.jwt")
public record JwtProperties(
        String secret,
        String issuer
) {
}

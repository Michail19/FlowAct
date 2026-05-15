package com.ms.userservice.security.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "flowact.security.password")
public record PasswordProperties(
        int bcryptStrength
) {
}

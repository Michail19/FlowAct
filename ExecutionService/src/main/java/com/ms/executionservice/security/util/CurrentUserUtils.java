package com.ms.executionservice.security.util;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.UUID;

public final class CurrentUserUtils {

    private CurrentUserUtils() {
    }

    public static UUID getCurrentUserId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)) {
            throw new IllegalStateException("JWT authentication is required");
        }

        return UUID.fromString(jwt.getSubject());
    }
}

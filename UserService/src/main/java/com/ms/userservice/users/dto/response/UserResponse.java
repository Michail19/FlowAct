package com.ms.userservice.users.dto.response;

import com.ms.userservice.users.entity.UserAccountType;
import com.ms.userservice.users.entity.UserRole;
import com.ms.userservice.users.entity.UserStatus;

import java.time.OffsetDateTime;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String email,
        String username,
        String displayName,
        String avatarUrl,
        UserRole role,
        UserStatus status,
        UserAccountType accountType,
        OffsetDateTime demoExpiresAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}

package com.ms.userservice.admin.dto.response;

import com.ms.userservice.users.entity.UserAccountType;
import com.ms.userservice.users.entity.UserRole;
import com.ms.userservice.users.entity.UserStatus;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminUserResponse(
        UUID id,
        String email,
        String username,
        String displayName,
        String avatarUrl,
        UserRole role,
        UserStatus status,
        UserAccountType accountType,
        OffsetDateTime demoExpiresAt,
        OffsetDateTime lastLoginAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}

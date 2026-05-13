package com.ms.userservice.users.dto.response;

import com.ms.userservice.users.entity.UserRole;
import com.ms.userservice.users.entity.UserStatus;

import java.time.OffsetDateTime;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String email,
        String displayName,
        UserRole role,
        UserStatus status,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}

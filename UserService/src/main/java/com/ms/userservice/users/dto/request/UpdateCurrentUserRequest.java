package com.ms.userservice.users.dto.request;

import jakarta.validation.constraints.Size;

public record UpdateCurrentUserRequest(
        @Size(min = 2, max = 64)
        String username,

        @Size(max = 255)
        String displayName,

        @Size(max = 700000)
        String avatarUrl
) {
}

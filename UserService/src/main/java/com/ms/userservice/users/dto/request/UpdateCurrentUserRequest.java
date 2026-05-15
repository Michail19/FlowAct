package com.ms.userservice.users.dto.request;

import jakarta.validation.constraints.Size;

public record UpdateCurrentUserRequest(
        @Size(max = 255)
        String displayName,

        @Size(max = 2048)
        String avatarUrl
) {
}

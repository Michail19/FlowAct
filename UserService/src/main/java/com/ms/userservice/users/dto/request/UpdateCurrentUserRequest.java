package com.ms.userservice.users.dto.request;

import jakarta.validation.constraints.Size;

public record UpdateCurrentUserRequest(
        @Size(max = 255)
        String displayName
) {
}

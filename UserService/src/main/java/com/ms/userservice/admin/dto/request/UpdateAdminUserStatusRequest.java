package com.ms.userservice.admin.dto.request;

import com.ms.userservice.users.entity.UserStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateAdminUserStatusRequest(
        @NotNull
        UserStatus status
) {
}

package com.ms.userservice.admin.dto.request;

import com.ms.userservice.users.entity.UserRole;
import jakarta.validation.constraints.NotNull;

public record UpdateAdminUserRoleRequest(
        @NotNull
        UserRole role
) {
}

package com.ms.userservice.admin.controller;

import com.ms.userservice.admin.dto.request.UpdateAdminUserRoleRequest;
import com.ms.userservice.admin.dto.request.UpdateAdminUserStatusRequest;
import com.ms.userservice.admin.dto.response.AdminActionResponse;
import com.ms.userservice.admin.dto.response.AdminStatsResponse;
import com.ms.userservice.admin.dto.response.AdminUserResponse;
import com.ms.userservice.admin.service.AdminUserService;
import com.ms.userservice.security.util.CurrentUserUtils;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @GetMapping("/stats")
    public AdminStatsResponse getStats() {
        return adminUserService.getStats();
    }

    @GetMapping("/users")
    public List<AdminUserResponse> getUsers() {
        return adminUserService.getUsers();
    }

    @GetMapping("/users/{userId}")
    public AdminUserResponse getUser(@PathVariable UUID userId) {
        return adminUserService.getUser(userId);
    }

    @PatchMapping("/users/{userId}/role")
    public AdminUserResponse updateUserRole(
            Authentication authentication,
            @PathVariable UUID userId,
            @Valid @RequestBody UpdateAdminUserRoleRequest request
    ) {
        UUID currentAdminId = CurrentUserUtils.getCurrentUserId(authentication);
        return adminUserService.updateUserRole(currentAdminId, userId, request);
    }

    @PatchMapping("/users/{userId}/status")
    public AdminUserResponse updateUserStatus(
            Authentication authentication,
            @PathVariable UUID userId,
            @Valid @RequestBody UpdateAdminUserStatusRequest request
    ) {
        UUID currentAdminId = CurrentUserUtils.getCurrentUserId(authentication);
        return adminUserService.updateUserStatus(currentAdminId, userId, request);
    }

    @PostMapping("/users/{userId}/revoke-sessions")
    public AdminActionResponse revokeUserSessions(
            Authentication authentication,
            @PathVariable UUID userId
    ) {
        UUID currentAdminId = CurrentUserUtils.getCurrentUserId(authentication);
        return new AdminActionResponse(
                adminUserService.revokeUserSessions(currentAdminId, userId)
        );
    }

    @DeleteMapping("/demo-users/expired")
    public AdminActionResponse cleanupExpiredDemoUsers() {
        return new AdminActionResponse(adminUserService.cleanupExpiredDemoUsers());
    }
}

package com.ms.userservice.admin.dto.response;

public record AdminStatsResponse(
        long totalUsers,
        long regularUsers,
        long demoUsers,
        long activeUsers,
        long blockedUsers,
        long deletedUsers,
        long adminUsers,
        long activeRefreshTokens
) {
}

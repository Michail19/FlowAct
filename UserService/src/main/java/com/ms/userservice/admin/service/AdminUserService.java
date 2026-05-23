package com.ms.userservice.admin.service;

import com.ms.userservice.admin.dto.request.UpdateAdminUserRoleRequest;
import com.ms.userservice.admin.dto.request.UpdateAdminUserStatusRequest;
import com.ms.userservice.admin.dto.response.AdminStatsResponse;
import com.ms.userservice.admin.dto.response.AdminUserResponse;
import com.ms.userservice.auth.entity.RefreshTokenEntity;
import com.ms.userservice.auth.repository.RefreshTokenRepository;
import com.ms.userservice.common.exception.NotFoundException;
import com.ms.userservice.users.entity.UserAccountType;
import com.ms.userservice.users.entity.UserEntity;
import com.ms.userservice.users.entity.UserRole;
import com.ms.userservice.users.entity.UserStatus;
import com.ms.userservice.users.repository.UserRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class AdminUserService {

    private static final String ADMIN_REVOKED_REASON = "ADMIN_REVOKED";
    private static final String ADMIN_STATUS_CHANGED_REASON = "ADMIN_STATUS_CHANGED";
    private static final String EXPIRED_DEMO_CLEANUP_REASON = "EXPIRED_DEMO_CLEANUP";

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;

    public AdminUserService(
            UserRepository userRepository,
            RefreshTokenRepository refreshTokenRepository
    ) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
    }

    @Transactional(readOnly = true)
    public List<AdminUserResponse> getUsers() {
        return userRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"))
                .stream()
                .map(this::toAdminUserResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public AdminUserResponse getUser(UUID userId) {
        return toAdminUserResponse(findUser(userId));
    }

    @Transactional(readOnly = true)
    public AdminStatsResponse getStats() {
        OffsetDateTime now = OffsetDateTime.now();

        return new AdminStatsResponse(
                userRepository.count(),
                userRepository.countByAccountType(UserAccountType.REGULAR),
                userRepository.countByAccountType(UserAccountType.DEMO),
                userRepository.countByStatus(UserStatus.ACTIVE),
                userRepository.countByStatus(UserStatus.BLOCKED),
                userRepository.countByStatus(UserStatus.DELETED),
                userRepository.countByRole(UserRole.ADMIN),
                refreshTokenRepository.countByRevokedAtIsNullAndExpiresAtAfter(now)
        );
    }

    @Transactional
    public AdminUserResponse updateUserRole(UUID currentAdminId, UUID userId, UpdateAdminUserRoleRequest request) {
        UserEntity user = findUser(userId);

        if (currentAdminId.equals(userId) && request.role() != UserRole.ADMIN) {
            throw new IllegalArgumentException("Admin cannot remove own admin role");
        }

        user.setRole(request.role());
        return toAdminUserResponse(userRepository.save(user));
    }

    @Transactional
    public AdminUserResponse updateUserStatus(UUID currentAdminId, UUID userId, UpdateAdminUserStatusRequest request) {
        UserEntity user = findUser(userId);

        if (currentAdminId.equals(userId) && request.status() != UserStatus.ACTIVE) {
            throw new IllegalArgumentException("Admin cannot block or delete own account");
        }

        user.setStatus(request.status());

        if (request.status() != UserStatus.ACTIVE) {
            revokeActiveRefreshTokens(userId, ADMIN_STATUS_CHANGED_REASON);
        }

        return toAdminUserResponse(userRepository.save(user));
    }

    @Transactional
    public int revokeUserSessions(UUID currentAdminId, UUID userId) {
        if (currentAdminId.equals(userId)) {
            throw new IllegalArgumentException("Admin cannot revoke own sessions from admin panel");
        }

        findUser(userId);
        return revokeActiveRefreshTokens(userId, ADMIN_REVOKED_REASON);
    }

    @Transactional
    public int cleanupExpiredDemoUsers() {
        OffsetDateTime now = OffsetDateTime.now();
        List<UserEntity> expiredDemoUsers = userRepository.findAllByAccountTypeAndDemoExpiresAtBefore(
                UserAccountType.DEMO,
                now
        );

        int affectedUsers = 0;

        for (UserEntity user : expiredDemoUsers) {
            if (user.getStatus() == UserStatus.DELETED) {
                continue;
            }

            user.setStatus(UserStatus.DELETED);
            revokeActiveRefreshTokens(user.getId(), EXPIRED_DEMO_CLEANUP_REASON);
            affectedUsers++;
        }

        userRepository.saveAll(expiredDemoUsers);
        return affectedUsers;
    }

    private UserEntity findUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    private int revokeActiveRefreshTokens(UUID userId, String reason) {
        OffsetDateTime now = OffsetDateTime.now();
        List<RefreshTokenEntity> activeTokens = refreshTokenRepository
                .findAllByUser_IdAndRevokedAtIsNullAndExpiresAtAfter(userId, now);

        for (RefreshTokenEntity token : activeTokens) {
            token.setRevokedAt(now);
            token.setRevokedReason(reason);
        }

        refreshTokenRepository.saveAll(activeTokens);
        return activeTokens.size();
    }

    private AdminUserResponse toAdminUserResponse(UserEntity user) {
        return new AdminUserResponse(
                user.getId(),
                user.getEmail(),
                user.getUsername(),
                user.getDisplayName(),
                user.getAvatarUrl(),
                user.getRole(),
                user.getStatus(),
                user.getAccountType(),
                user.getDemoExpiresAt(),
                user.getLastLoginAt(),
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }
}
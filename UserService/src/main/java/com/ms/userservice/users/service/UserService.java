package com.ms.userservice.users.service;

import com.ms.userservice.auth.entity.RefreshTokenEntity;
import com.ms.userservice.auth.repository.RefreshTokenRepository;
import com.ms.userservice.common.exception.NotFoundException;
import com.ms.userservice.common.exception.UnauthorizedException;
import com.ms.userservice.security.service.PasswordService;
import com.ms.userservice.users.dto.request.UpdateCredentialsRequest;
import com.ms.userservice.users.dto.request.UpdateCurrentUserRequest;
import com.ms.userservice.users.dto.response.UserResponse;
import com.ms.userservice.users.entity.UserEntity;
import com.ms.userservice.users.mapper.UserMapper;
import com.ms.userservice.users.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class UserService {

    private static final String CREDENTIALS_UPDATED_REASON = "CREDENTIALS_UPDATED";
    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-zA-Z0-9._-]{2,64}$");

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordService passwordService;
    private final UserMapper userMapper;

    public UserService(
            UserRepository userRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordService passwordService,
            UserMapper userMapper
    ) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordService = passwordService;
        this.userMapper = userMapper;
    }

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser(UUID userId) {
        UserEntity user = findUserById(userId);
        ensureUsernameInitialized(user);
        return userMapper.toResponse(user);
    }

    @Transactional
    public UserResponse updateCurrentUser(UUID userId, UpdateCurrentUserRequest request) {
        UserEntity user = findUserById(userId);
        user.setUsername(normalizeUsername(request.username(), user.getEmail()));
        user.setDisplayName(normalizeNullableText(request.displayName()));
        user.setAvatarUrl(normalizeAvatarUrl(request.avatarUrl()));
        return userMapper.toResponse(userRepository.save(user));
    }

    @Transactional
    public void updateCredentials(UUID userId, UpdateCredentialsRequest request) {
        UserEntity user = findUserById(userId);

        if (!passwordService.matches(request.currentSecret(), user.getPasswordHash())) {
            throw new UnauthorizedException("Current password is invalid");
        }

        if (passwordService.matches(request.newSecret(), user.getPasswordHash())) {
            throw new IllegalArgumentException("New password must be different from current password");
        }

        user.setPasswordHash(passwordService.hash(request.newSecret()));
        userRepository.save(user);

        revokeActiveRefreshTokens(userId);
    }

    private void revokeActiveRefreshTokens(UUID userId) {
        OffsetDateTime now = OffsetDateTime.now();
        List<RefreshTokenEntity> activeTokens = refreshTokenRepository
                .findAllByUser_IdAndRevokedAtIsNullAndExpiresAtAfter(userId, now);

        for (RefreshTokenEntity token : activeTokens) {
            token.setRevokedAt(now);
            token.setRevokedReason(CREDENTIALS_UPDATED_REASON);
        }

        refreshTokenRepository.saveAll(activeTokens);
    }

    private UserEntity findUserById(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    private void ensureUsernameInitialized(UserEntity user) {
        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            return;
        }

        user.setUsername(normalizeUsername(null, user.getEmail()));
        userRepository.save(user);
    }

    private String normalizeNullableText(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        if (value.indexOf(0) >= 0) {
            throw new IllegalArgumentException("Text fields must not contain null bytes");
        }

        return value.trim();
    }

    private String normalizeUsername(String username, String email) {
        String normalizedUsername = normalizeNullableText(username);

        if (normalizedUsername == null) {
            normalizedUsername = email.split("@", 2)[0].trim();
        }

        if (!USERNAME_PATTERN.matcher(normalizedUsername).matches()) {
            throw new IllegalArgumentException("Username must contain 2-64 latin letters, digits, dots, dashes or underscores");
        }

        return normalizedUsername;
    }

    private String normalizeAvatarUrl(String avatarUrl) {
        String normalizedAvatarUrl = normalizeNullableText(avatarUrl);

        if (normalizedAvatarUrl == null) {
            return null;
        }

        if (
                !normalizedAvatarUrl.startsWith("http://") &&
                !normalizedAvatarUrl.startsWith("https://") &&
                !normalizedAvatarUrl.startsWith("data:image/")
        ) {
            throw new IllegalArgumentException("Avatar must be an HTTP URL or image data URL");
        }

        return normalizedAvatarUrl;
    }
}

package com.ms.userservice.auth.service;

import com.ms.userservice.auth.dto.request.LoginRequest;
import com.ms.userservice.auth.dto.request.RefreshTokenRequest;
import com.ms.userservice.auth.dto.request.RegisterRequest;
import com.ms.userservice.auth.dto.response.AuthResponse;
import com.ms.userservice.auth.dto.response.TokenResponse;
import com.ms.userservice.common.exception.ConflictException;
import com.ms.userservice.common.exception.UnauthorizedException;
import com.ms.userservice.security.service.JwtService;
import com.ms.userservice.security.service.PasswordService;
import com.ms.userservice.users.entity.UserAccountType;
import com.ms.userservice.users.entity.UserEntity;
import com.ms.userservice.users.entity.UserRole;
import com.ms.userservice.users.entity.UserStatus;
import com.ms.userservice.users.mapper.UserMapper;
import com.ms.userservice.users.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.UUID;

@Service
public class AuthService {

    private static final long DEMO_SESSION_TTL_HOURS = 24;

    private final UserRepository userRepository;
    private final PasswordService passwordService;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final UserMapper userMapper;

    public AuthService(
            UserRepository userRepository,
            PasswordService passwordService,
            JwtService jwtService,
            RefreshTokenService refreshTokenService,
            UserMapper userMapper
    ) {
        this.userRepository = userRepository;
        this.passwordService = passwordService;
        this.jwtService = jwtService;
        this.refreshTokenService = refreshTokenService;
        this.userMapper = userMapper;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request, HttpServletRequest servletRequest) {
        String normalizedEmail = normalizeEmail(request.email());

        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new ConflictException("User with this email already exists");
        }

        UserEntity user = UserEntity.builder()
                .id(UUID.randomUUID())
                .email(normalizedEmail)
                .passwordHash(passwordService.hash(request.password()))
                .displayName(normalizeDisplayName(request.displayName()))
                .avatarUrl(null)
                .role(UserRole.USER)
                .status(UserStatus.ACTIVE)
                .accountType(UserAccountType.REGULAR)
                .demoExpiresAt(null)
                .lastLoginAt(OffsetDateTime.now())
                .build();

        UserEntity savedUser = userRepository.save(user);
        String accessToken = jwtService.generateAccessToken(savedUser);
        String refreshToken = refreshTokenService.create(savedUser, servletRequest);

        return new AuthResponse(
                accessToken,
                refreshToken,
                userMapper.toResponse(savedUser)
        );
    }

    @Transactional
    public AuthResponse login(LoginRequest request, HttpServletRequest servletRequest) {
        String normalizedEmail = normalizeEmail(request.email());
        UserEntity user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));

        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new UnauthorizedException("User account is not active");
        }

        if (user.getAccountType() == UserAccountType.DEMO
                && user.getDemoExpiresAt() != null
                && user.getDemoExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new UnauthorizedException("Demo session expired");
        }

        if (!passwordService.matches(request.password(), user.getPasswordHash())) {
            throw new UnauthorizedException("Invalid email or password");
        }

        user.setLastLoginAt(OffsetDateTime.now());
        UserEntity savedUser = userRepository.save(user);

        String accessToken = jwtService.generateAccessToken(savedUser);
        String refreshToken = refreshTokenService.create(savedUser, servletRequest);

        return new AuthResponse(
                accessToken,
                refreshToken,
                userMapper.toResponse(savedUser)
        );
    }

    @Transactional
    public AuthResponse createDemoSession(HttpServletRequest servletRequest) {
        OffsetDateTime now = OffsetDateTime.now();
        UUID userId = UUID.randomUUID();

        UserEntity user = UserEntity.builder()
                .id(userId)
                .email("demo-" + userId + "@flowact.local")
                .passwordHash(passwordService.hash(UUID.randomUUID().toString()))
                .displayName("Demo user")
                .avatarUrl(null)
                .role(UserRole.USER)
                .status(UserStatus.ACTIVE)
                .accountType(UserAccountType.DEMO)
                .demoExpiresAt(now.plusHours(DEMO_SESSION_TTL_HOURS))
                .lastLoginAt(now)
                .build();

        UserEntity savedUser = userRepository.save(user);
        String accessToken = jwtService.generateAccessToken(savedUser);
        String refreshToken = refreshTokenService.create(savedUser, servletRequest);

        return new AuthResponse(
                accessToken,
                refreshToken,
                userMapper.toResponse(savedUser)
        );
    }

    @Transactional
    public TokenResponse refresh(RefreshTokenRequest request, HttpServletRequest servletRequest) {
        RefreshTokenService.RefreshTokenRotation rotation = refreshTokenService.rotate(
                request.refreshToken(),
                servletRequest
        );

        UserEntity user = rotation.user();

        if (user.getAccountType() == UserAccountType.DEMO
                && user.getDemoExpiresAt() != null
                && user.getDemoExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new UnauthorizedException("Demo session expired");
        }

        String accessToken = jwtService.generateAccessToken(user);

        return new TokenResponse(accessToken, rotation.refreshToken());
    }

    @Transactional
    public void logout(RefreshTokenRequest request) {
        refreshTokenService.revoke(request.refreshToken());
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeDisplayName(String displayName) {
        if (displayName == null || displayName.isBlank()) {
            return null;
        }
        return displayName.trim();
    }
}

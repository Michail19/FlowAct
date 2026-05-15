package com.ms.userservice.auth.service;

import com.ms.userservice.auth.entity.RefreshTokenEntity;
import com.ms.userservice.auth.repository.RefreshTokenRepository;
import com.ms.userservice.common.exception.UnauthorizedException;
import com.ms.userservice.security.config.JwtProperties;
import com.ms.userservice.users.entity.UserEntity;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class RefreshTokenService {

    private static final int TOKEN_BYTES_LENGTH = 64;
    private static final String REASON_LOGOUT = "LOGOUT";
    private static final String REASON_ROTATED = "ROTATED";

    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtProperties jwtProperties;
    private final SecureRandom secureRandom = new SecureRandom();

    public RefreshTokenService(
            RefreshTokenRepository refreshTokenRepository,
            JwtProperties jwtProperties
    ) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtProperties = jwtProperties;
    }

    @Transactional
    public String create(UserEntity user, HttpServletRequest request) {
        String rawToken = generateRawToken();
        RefreshTokenEntity entity = RefreshTokenEntity.builder()
                .id(UUID.randomUUID())
                .user(user)
                .tokenHash(hash(rawToken))
                .expiresAt(OffsetDateTime.now().plusDays(jwtProperties.refreshTokenTtlDays()))
                .userAgent(extractUserAgent(request))
                .ipAddress(extractIpAddress(request))
                .createdAt(OffsetDateTime.now())
                .build();

        refreshTokenRepository.save(entity);
        return rawToken;
    }

    @Transactional
    public RefreshTokenRotation rotate(String rawToken, HttpServletRequest request) {
        RefreshTokenEntity currentToken = getActiveToken(rawToken);
        String newRawToken = create(currentToken.getUser(), request);
        RefreshTokenEntity newToken = refreshTokenRepository.findByTokenHash(hash(newRawToken))
                .orElseThrow(() -> new UnauthorizedException("Refresh token was not created"));

        currentToken.setRevokedAt(OffsetDateTime.now());
        currentToken.setRevokedReason(REASON_ROTATED);
        currentToken.setReplacedByToken(newToken);
        refreshTokenRepository.save(currentToken);

        return new RefreshTokenRotation(currentToken.getUser(), newRawToken);
    }

    @Transactional
    public void revoke(String rawToken) {
        RefreshTokenEntity currentToken = refreshTokenRepository.findByTokenHash(hash(rawToken))
                .orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));

        if (!currentToken.isRevoked()) {
            currentToken.setRevokedAt(OffsetDateTime.now());
            currentToken.setRevokedReason(REASON_LOGOUT);
            refreshTokenRepository.save(currentToken);
        }
    }

    private RefreshTokenEntity getActiveToken(String rawToken) {
        RefreshTokenEntity token = refreshTokenRepository.findByTokenHash(hash(rawToken))
                .orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));

        if (!token.isActive()) {
            throw new UnauthorizedException("Refresh token is expired or revoked");
        }

        return token;
    }

    public String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 algorithm is not available", exception);
        }
    }

    private String generateRawToken() {
        byte[] bytes = new byte[TOKEN_BYTES_LENGTH];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String extractUserAgent(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        return request.getHeader("User-Agent");
    }

    private String extractIpAddress(HttpServletRequest request) {
        if (request == null) {
            return null;
        }

        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }

        return request.getRemoteAddr();
    }

    public record RefreshTokenRotation(
            UserEntity user,
            String refreshToken
    ) {
    }
}

package com.ms.userservice.auth.repository;

import com.ms.userservice.auth.entity.RefreshTokenEntity;
import com.ms.userservice.users.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshTokenEntity, UUID> {

    Optional<RefreshTokenEntity> findByTokenHash(String tokenHash);

    List<RefreshTokenEntity> findAllByUserAndRevokedAtIsNullAndExpiresAtAfter(
            UserEntity user,
            OffsetDateTime now
    );

    List<RefreshTokenEntity> findAllByUser_IdAndRevokedAtIsNullAndExpiresAtAfter(
            UUID userId,
            OffsetDateTime now
    );

    long countByRevokedAtIsNullAndExpiresAtAfter(OffsetDateTime now);
}

package com.ms.userservice.auth.repository;

import com.ms.userservice.auth.entity.RefreshTokenEntity;
import com.ms.userservice.users.entity.UserEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
       select token
       from RefreshTokenEntity token
       where token.tokenHash = :tokenHash
       """)
    Optional<RefreshTokenEntity> findByTokenHashForUpdate(
            @Param("tokenHash") String tokenHash
    );
}

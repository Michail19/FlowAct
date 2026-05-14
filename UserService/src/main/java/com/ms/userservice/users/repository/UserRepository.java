package com.ms.userservice.users.repository;

import com.ms.userservice.users.entity.UserAccountType;
import com.ms.userservice.users.entity.UserEntity;
import com.ms.userservice.users.entity.UserRole;
import com.ms.userservice.users.entity.UserStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<UserEntity, UUID> {

    Optional<UserEntity> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    long countByRole(UserRole role);

    long countByStatus(UserStatus status);

    long countByAccountType(UserAccountType accountType);

    List<UserEntity> findAllByAccountTypeAndDemoExpiresAtBefore(
            UserAccountType accountType,
            OffsetDateTime now
    );
}

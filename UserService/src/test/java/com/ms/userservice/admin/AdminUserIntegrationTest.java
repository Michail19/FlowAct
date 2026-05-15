package com.ms.userservice.admin;

import com.ms.userservice.AbstractIntegrationTest;
import com.ms.userservice.auth.entity.RefreshTokenEntity;
import com.ms.userservice.users.entity.UserEntity;
import com.ms.userservice.users.entity.UserRole;
import com.ms.userservice.users.entity.UserStatus;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AdminUserIntegrationTest extends AbstractIntegrationTest {

    @Test
    void userCannotAccessAdminEndpoints() {
        AuthResponse user = register("plain-user@example.com", "password123", "Plain User");

        ResponseEntity<String> response = restTemplate.exchange(
                "/api/v1/admin/users",
                HttpMethod.GET,
                authorizedEntity(user.accessToken()),
                String.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void adminCanReadStatsAndUsers() {
        createUser("admin@example.com", "password123", UserRole.ADMIN, UserStatus.ACTIVE);
        createUser("blocked@example.com", "password123", UserRole.USER, UserStatus.BLOCKED);
        createExpiredDemoUser("expired-demo@example.com");
        AuthResponse admin = login("admin@example.com", "password123");

        ResponseEntity<AdminStatsResponse> statsResponse = restTemplate.exchange(
                "/api/v1/admin/stats",
                HttpMethod.GET,
                authorizedEntity(admin.accessToken()),
                AdminStatsResponse.class
        );

        assertThat(statsResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        AdminStatsResponse stats = Objects.requireNonNull(statsResponse.getBody());
        assertThat(stats.totalUsers()).isEqualTo(3);
        assertThat(stats.adminUsers()).isEqualTo(1);
        assertThat(stats.blockedUsers()).isEqualTo(1);
        assertThat(stats.demoUsers()).isEqualTo(1);
        assertThat(stats.activeRefreshTokens()).isEqualTo(1);

        ResponseEntity<AdminUserResponse[]> usersResponse = restTemplate.exchange(
                "/api/v1/admin/users",
                HttpMethod.GET,
                authorizedEntity(admin.accessToken()),
                AdminUserResponse[].class
        );

        assertThat(usersResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(Objects.requireNonNull(usersResponse.getBody()))
                .extracting(AdminUserResponse::email)
                .contains("admin@example.com", "blocked@example.com", "expired-demo@example.com");
    }

    @Test
    void adminCanPromoteUserBlockUserAndRevokeSessions() {
        UserEntity adminUser = createUser("admin@example.com", "password123", UserRole.ADMIN, UserStatus.ACTIVE);
        AuthResponse regular = register("regular@example.com", "password123", "Regular User");
        AuthResponse admin = login("admin@example.com", "password123");

        ResponseEntity<AdminUserResponse> promoted = restTemplate.exchange(
                "/api/v1/admin/users/{userId}/role",
                HttpMethod.PATCH,
                authorizedEntity(admin.accessToken(), Map.of("role", "ADMIN")),
                AdminUserResponse.class,
                regular.user().id()
        );

        assertThat(promoted.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(Objects.requireNonNull(promoted.getBody()).role()).isEqualTo("ADMIN");
        assertThat(userRepository.findById(regular.user().id()).orElseThrow().getRole())
                .isEqualTo(UserRole.ADMIN);

        ResponseEntity<AdminActionResponse> revoked = restTemplate.exchange(
                "/api/v1/admin/users/{userId}/revoke-sessions",
                HttpMethod.POST,
                authorizedEntity(admin.accessToken()),
                AdminActionResponse.class,
                regular.user().id()
        );

        assertThat(revoked.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(Objects.requireNonNull(revoked.getBody()).affectedCount()).isEqualTo(1);
        RefreshTokenEntity regularToken = refreshTokenRepository.findAll()
                .stream()
                .filter(token -> token.getUser().getId().equals(regular.user().id()))
                .findFirst()
                .orElseThrow();
        assertThat(regularToken.isRevoked()).isTrue();
        assertThat(regularToken.getRevokedReason()).isEqualTo("ADMIN_REVOKED");

        ResponseEntity<AdminUserResponse> blocked = restTemplate.exchange(
                "/api/v1/admin/users/{userId}/status",
                HttpMethod.PATCH,
                authorizedEntity(admin.accessToken(), Map.of("status", "BLOCKED")),
                AdminUserResponse.class,
                regular.user().id()
        );

        assertThat(blocked.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(Objects.requireNonNull(blocked.getBody()).status()).isEqualTo("BLOCKED");
        assertThat(userRepository.findById(regular.user().id()).orElseThrow().getStatus())
                .isEqualTo(UserStatus.BLOCKED);

        ResponseEntity<String> blockedLogin = restTemplate.postForEntity(
                "/api/v1/auth/login",
                Map.of(
                        "email", "regular@example.com",
                        "password", "password123"
                ),
                String.class
        );
        assertThat(blockedLogin.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        assertThat(adminUser.getId()).isNotNull();
    }

    @Test
    void adminCannotRemoveOwnAdminRoleOrBlockSelf() {
        UserEntity adminUser = createUser("admin@example.com", "password123", UserRole.ADMIN, UserStatus.ACTIVE);
        AuthResponse admin = login("admin@example.com", "password123");

        ResponseEntity<String> removeOwnRole = restTemplate.exchange(
                "/api/v1/admin/users/{userId}/role",
                HttpMethod.PATCH,
                authorizedEntity(admin.accessToken(), Map.of("role", "USER")),
                String.class,
                adminUser.getId()
        );
        assertThat(removeOwnRole.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        ResponseEntity<String> blockSelf = restTemplate.exchange(
                "/api/v1/admin/users/{userId}/status",
                HttpMethod.PATCH,
                authorizedEntity(admin.accessToken(), Map.of("status", "BLOCKED")),
                String.class,
                adminUser.getId()
        );
        assertThat(blockSelf.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        UserEntity reloadedAdmin = userRepository.findById(adminUser.getId()).orElseThrow();
        assertThat(reloadedAdmin.getRole()).isEqualTo(UserRole.ADMIN);
        assertThat(reloadedAdmin.getStatus()).isEqualTo(UserStatus.ACTIVE);
    }

    @Test
    void adminCanMarkExpiredDemoUsersAsDeleted() {
        createUser("admin@example.com", "password123", UserRole.ADMIN, UserStatus.ACTIVE);
        UserEntity expiredDemo = createExpiredDemoUser("expired-demo@example.com");
        AuthResponse admin = login("admin@example.com", "password123");

        ResponseEntity<AdminActionResponse> cleanup = restTemplate.exchange(
                "/api/v1/admin/demo-users/expired",
                HttpMethod.DELETE,
                authorizedEntity(admin.accessToken()),
                AdminActionResponse.class
        );

        assertThat(cleanup.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(Objects.requireNonNull(cleanup.getBody()).affectedCount()).isEqualTo(1);
        assertThat(userRepository.findById(expiredDemo.getId()).orElseThrow().getStatus())
                .isEqualTo(UserStatus.DELETED);
    }

    @Test
    void adminRequestsReturnNotFoundForUnknownUser() {
        createUser("admin@example.com", "password123", UserRole.ADMIN, UserStatus.ACTIVE);
        AuthResponse admin = login("admin@example.com", "password123");

        ResponseEntity<String> response = restTemplate.exchange(
                "/api/v1/admin/users/{userId}",
                HttpMethod.GET,
                authorizedEntity(admin.accessToken()),
                String.class,
                UUID.randomUUID()
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}

package com.ms.userservice.auth;

import com.ms.userservice.AbstractIntegrationTest;
import com.ms.userservice.auth.entity.RefreshTokenEntity;
import com.ms.userservice.users.entity.UserEntity;
import com.ms.userservice.users.entity.UserStatus;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;

class AuthFlowIntegrationTest extends AbstractIntegrationTest {

    @Test
    void registerCreatesUserAndRefreshTokenWithNormalizedEmail() {
        AuthResponse response = register("  Test.User@Example.COM  ", "password123", " Test User ");

        assertThat(response.accessToken()).isNotBlank();
        assertThat(response.refreshToken()).isNotBlank();
        assertThat(response.user().email()).isEqualTo("test.user@example.com");
        assertThat(response.user().displayName()).isEqualTo("Test User");
        assertThat(response.user().role()).isEqualTo("USER");
        assertThat(response.user().status()).isEqualTo("ACTIVE");
        assertThat(response.user().accountType()).isEqualTo("REGULAR");

        UserEntity savedUser = userRepository.findByEmailIgnoreCase("test.user@example.com").orElseThrow();
        assertThat(savedUser.getPasswordHash()).isNotEqualTo("password123");
        assertThat(passwordEncoder.matches("password123", savedUser.getPasswordHash())).isTrue();

        assertThat(refreshTokenRepository.findAll())
                .hasSize(1)
                .first()
                .extracting(RefreshTokenEntity::isActive)
                .isEqualTo(true);
    }

    @Test
    void duplicateEmailIgnoringCaseReturnsConflict() {
        register("duplicate@example.com", "password123", "First");

        ResponseEntity<String> response = restTemplate.postForEntity(
                "/api/v1/auth/register",
                Map.of(
                        "email", "DUPLICATE@example.com",
                        "password", "password123",
                        "displayName", "Second"
                ),
                String.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(userRepository.count()).isEqualTo(1);
    }

    @Test
    void invalidRegisterPayloadReturnsBadRequest() {
        ResponseEntity<String> response = restTemplate.postForEntity(
                "/api/v1/auth/register",
                Map.of(
                        "email", "not-an-email",
                        "password", "short"
                ),
                String.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(userRepository.count()).isZero();
    }

    @Test
    void loginRejectsInvalidPasswordAndBlockedUser() {
        register("login@example.com", "password123", "Login User");

        ResponseEntity<String> wrongPassword = restTemplate.postForEntity(
                "/api/v1/auth/login",
                Map.of(
                        "email", "login@example.com",
                        "password", "wrong-password"
                ),
                String.class
        );
        assertThat(wrongPassword.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        UserEntity user = userRepository.findByEmailIgnoreCase("login@example.com").orElseThrow();
        user.setStatus(UserStatus.BLOCKED);
        userRepository.saveAndFlush(user);

        ResponseEntity<String> blocked = restTemplate.postForEntity(
                "/api/v1/auth/login",
                Map.of(
                        "email", "login@example.com",
                        "password", "password123"
                ),
                String.class
        );
        assertThat(blocked.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void refreshRotatesTokenAndRejectsOldToken() {
        AuthResponse registered = register("refresh@example.com", "password123", "Refresh User");

        ResponseEntity<TokenResponse> refreshResponse = restTemplate.postForEntity(
                "/api/v1/auth/refresh",
                Map.of("refreshToken", registered.refreshToken()),
                TokenResponse.class
        );

        assertThat(refreshResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        TokenResponse tokens = Objects.requireNonNull(refreshResponse.getBody());
        assertThat(tokens.accessToken()).isNotBlank();
        assertThat(tokens.refreshToken()).isNotBlank().isNotEqualTo(registered.refreshToken());

        List<RefreshTokenEntity> tokenRows = refreshTokenRepository.findAll();
        assertThat(tokenRows).hasSize(2);
        assertThat(tokenRows).anySatisfy(token -> {
            assertThat(token.isRevoked()).isTrue();
            assertThat(token.getRevokedReason()).isEqualTo("ROTATED");
        });
        assertThat(tokenRows).anySatisfy(token -> assertThat(token.isActive()).isTrue());

        ResponseEntity<String> oldTokenReuse = restTemplate.postForEntity(
                "/api/v1/auth/refresh",
                Map.of("refreshToken", registered.refreshToken()),
                String.class
        );
        assertThat(oldTokenReuse.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void logoutRevokesRefreshTokenAndPreventsRefresh() {
        AuthResponse registered = register("logout@example.com", "password123", "Logout User");

        ResponseEntity<Void> logoutResponse = restTemplate.postForEntity(
                "/api/v1/auth/logout",
                Map.of("refreshToken", registered.refreshToken()),
                Void.class
        );

        assertThat(logoutResponse.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        RefreshTokenEntity token = refreshTokenRepository.findAll().getFirst();
        assertThat(token.isRevoked()).isTrue();
        assertThat(token.getRevokedReason()).isEqualTo("LOGOUT");

        ResponseEntity<String> refreshAfterLogout = restTemplate.postForEntity(
                "/api/v1/auth/refresh",
                Map.of("refreshToken", registered.refreshToken()),
                String.class
        );
        assertThat(refreshAfterLogout.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void currentUserProfileRequiresJwtAndCanBeUpdated() {
        AuthResponse registered = register("profile@example.com", "password123", "Profile User");

        ResponseEntity<String> anonymous = restTemplate.getForEntity("/api/v1/users/me", String.class);
        assertThat(anonymous.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        ResponseEntity<UserResponse> currentUser = restTemplate.exchange(
                "/api/v1/users/me",
                HttpMethod.GET,
                authorizedEntity(registered.accessToken()),
                UserResponse.class
        );
        assertThat(currentUser.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(Objects.requireNonNull(currentUser.getBody()).email()).isEqualTo("profile@example.com");

        ResponseEntity<UserResponse> updated = restTemplate.exchange(
                "/api/v1/users/me",
                HttpMethod.PATCH,
                authorizedEntity(
                        registered.accessToken(),
                        Map.of(
                                "displayName", " Updated Profile ",
                                "avatarUrl", "https://example.com/avatar.png"
                        )
                ),
                UserResponse.class
        );

        assertThat(updated.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(Objects.requireNonNull(updated.getBody()).displayName()).isEqualTo("Updated Profile");
        assertThat(updated.getBody().avatarUrl()).isEqualTo("https://example.com/avatar.png");
    }

    @Test
    void invalidAvatarUrlReturnsBadRequest() {
        AuthResponse registered = register("avatar@example.com", "password123", "Avatar User");

        ResponseEntity<String> response = restTemplate.exchange(
                "/api/v1/users/me",
                HttpMethod.PATCH,
                authorizedEntity(
                        registered.accessToken(),
                        Map.of("avatarUrl", "ftp://example.com/avatar.png")
                ),
                String.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void passwordChangeRevokesActiveRefreshTokensAndRequiresNewPassword() {
        AuthResponse registered = register("credentials@example.com", "password123", "Credentials User");

        ResponseEntity<Void> changePassword = restTemplate.exchange(
                "/api/v1/users/me/change-password",
                HttpMethod.POST,
                authorizedEntity(
                        registered.accessToken(),
                        Map.of(
                                "currentSecret", "password123",
                                "newSecret", "newPassword123"
                        )
                ),
                Void.class
        );

        assertThat(changePassword.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        RefreshTokenEntity token = refreshTokenRepository.findAll().getFirst();
        assertThat(token.isRevoked()).isTrue();
        assertThat(token.getRevokedReason()).isEqualTo("CREDENTIALS_UPDATED");

        ResponseEntity<String> oldPasswordLogin = restTemplate.postForEntity(
                "/api/v1/auth/login",
                Map.of(
                        "email", "credentials@example.com",
                        "password", "password123"
                ),
                String.class
        );
        assertThat(oldPasswordLogin.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        AuthResponse newPasswordLogin = login("credentials@example.com", "newPassword123");
        assertThat(newPasswordLogin.accessToken()).isNotBlank();
    }
}

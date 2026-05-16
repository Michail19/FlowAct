package com.ms.userservice;

import com.ms.userservice.auth.repository.RefreshTokenRepository;
import com.ms.userservice.users.entity.UserAccountType;
import com.ms.userservice.users.entity.UserEntity;
import com.ms.userservice.users.entity.UserRole;
import com.ms.userservice.users.entity.UserStatus;
import com.ms.userservice.users.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public abstract class AbstractIntegrationTest {

    private static final String TEST_JWT_SECRET = "test-secret-for-user-service-integration-tests-32-characters";

    @Container
    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("flowact_users_test")
            .withUsername("postgres")
            .withPassword("postgres");

    @Autowired
    protected TestRestTemplate restTemplate;

    @Autowired
    protected UserRepository userRepository;

    @Autowired
    protected RefreshTokenRepository refreshTokenRepository;

    @Autowired
    protected PasswordEncoder passwordEncoder;

    @Autowired
    protected JdbcTemplate jdbcTemplate;

    @DynamicPropertySource
    static void registerDynamicProperties(DynamicPropertyRegistry registry) {
        registry.add("DB_URL", POSTGRES::getJdbcUrl);
        registry.add("DB_USERNAME", POSTGRES::getUsername);
        registry.add("DB_PASSWORD", POSTGRES::getPassword);
        registry.add("JWT_SECRET", () -> TEST_JWT_SECRET);
        registry.add("JWT_ISSUER", () -> "flowact-user-service-test");
        registry.add("JWT_ACCESS_TOKEN_TTL_MINUTES", () -> "30");
        registry.add("JWT_REFRESH_TOKEN_TTL_DAYS", () -> "14");
        registry.add("BCRYPT_STRENGTH", () -> "4");

        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        registry.add("spring.flyway.enabled", () -> "true");
        registry.add("flowact.security.jwt.secret", () -> TEST_JWT_SECRET);
        registry.add("flowact.security.jwt.issuer", () -> "flowact-user-service-test");
        registry.add("flowact.security.jwt.access-token-ttl-minutes", () -> "30");
        registry.add("flowact.security.jwt.refresh-token-ttl-days", () -> "14");
        registry.add("flowact.security.password.bcrypt-strength", () -> "4");
    }

    @BeforeEach
    void cleanDatabase() {
        jdbcTemplate.execute("TRUNCATE TABLE refresh_tokens, users RESTART IDENTITY CASCADE");
    }

    protected AuthResponse register(String email, String password, String displayName) {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("email", email == null ? null : email.trim());
        request.put("password", password);
        request.put("displayName", displayName);

        ResponseEntity<AuthResponse> response = restTemplate.postForEntity(
                "/api/v1/auth/register",
                request,
                AuthResponse.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return Objects.requireNonNull(response.getBody());
    }

    protected AuthResponse login(String email, String password) {
        ResponseEntity<AuthResponse> response = restTemplate.postForEntity(
                "/api/v1/auth/login",
                Map.of(
                        "email", email,
                        "password", password
                ),
                AuthResponse.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        return Objects.requireNonNull(response.getBody());
    }

    protected UserEntity createUser(
            String email,
            String rawPassword,
            UserRole role,
            UserStatus status
    ) {
        UserEntity user = UserEntity.builder()
                .id(UUID.randomUUID())
                .email(email.trim().toLowerCase(Locale.ROOT))
                .passwordHash(passwordEncoder.encode(rawPassword))
                .displayName(email)
                .avatarUrl(null)
                .role(role)
                .status(status)
                .accountType(UserAccountType.REGULAR)
                .demoExpiresAt(null)
                .lastLoginAt(null)
                .build();

        return userRepository.saveAndFlush(user);
    }

    protected UserEntity createExpiredDemoUser(String email) {
        UserEntity user = UserEntity.builder()
                .id(UUID.randomUUID())
                .email(email.trim().toLowerCase(Locale.ROOT))
                .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString()))
                .displayName("Expired demo")
                .avatarUrl(null)
                .role(UserRole.USER)
                .status(UserStatus.ACTIVE)
                .accountType(UserAccountType.DEMO)
                .demoExpiresAt(OffsetDateTime.now().minusHours(1))
                .lastLoginAt(OffsetDateTime.now().minusHours(25))
                .build();

        return userRepository.saveAndFlush(user);
    }

    protected HttpHeaders authHeaders(String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    protected HttpEntity<Void> authorizedEntity(String accessToken) {
        return new HttpEntity<>(authHeaders(accessToken));
    }

    protected <T> HttpEntity<T> authorizedEntity(String accessToken, T body) {
        return new HttpEntity<>(body, authHeaders(accessToken));
    }

    protected record AuthResponse(
            String accessToken,
            String refreshToken,
            UserResponse user
    ) {
    }

    protected record TokenResponse(
            String accessToken,
            String refreshToken
    ) {
    }

    protected record UserResponse(
            UUID id,
            String email,
            String displayName,
            String avatarUrl,
            String role,
            String status,
            String accountType
    ) {
    }

    protected record AdminStatsResponse(
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

    protected record AdminUserResponse(
            UUID id,
            String email,
            String displayName,
            String avatarUrl,
            String role,
            String status,
            String accountType,
            OffsetDateTime demoExpiresAt,
            OffsetDateTime lastLoginAt,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt
    ) {
    }

    protected record AdminActionResponse(int affectedCount) {
    }
}

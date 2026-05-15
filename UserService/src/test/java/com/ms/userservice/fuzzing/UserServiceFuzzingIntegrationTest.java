package com.ms.userservice.fuzzing;

import com.ms.userservice.AbstractIntegrationTest;
import com.ms.userservice.users.entity.UserEntity;
import com.ms.userservice.users.entity.UserRole;
import com.ms.userservice.users.entity.UserStatus;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("fuzzing")
class UserServiceFuzzingIntegrationTest extends AbstractIntegrationTest {

    @Test
    void authEndpointsWithFuzzedPayloadsNeverReturnServerError() {
        List<Map<String, Object>> payloads = List.of(
                mapOf("email", "", "password", "", "displayName", ""),
                mapOf("email", "not-an-email", "password", "short", "displayName", fuzzString(32)),
                mapOf("email", fuzzString(330), "password", fuzzString(129), "displayName", fuzzString(300)),
                mapOf("email", "<script>alert(1)</script>", "password", "password123", "displayName", "<b>x</b>"),
                mapOf("email", "' OR '1'='1@example.com", "password", "password123", "displayName", "SQL"),
                mapOf("email", null, "password", "password123", "displayName", "Null email"),
                mapOf("email", "null-password@example.com", "password", null, "displayName", "Null password"),
                mapOf("email", 12345, "password", true, "displayName", List.of("array")),
                mapOf("refreshToken", ""),
                mapOf("refreshToken", fuzzString(4096)),
                mapOf("refreshToken", null),
                mapOf("unexpected", Map.of("nested", List.of(1, 2, 3)))
        );

        for (Map<String, Object> payload : payloads) {
            assertNoServerError(postJson("/api/v1/auth/register", payload));
            assertNoServerError(postJson("/api/v1/auth/login", payload));
            assertNoServerError(postJson("/api/v1/auth/refresh", payload));
            assertNoServerError(postJson("/api/v1/auth/logout", payload));
        }
    }

    @Test
    void authEndpointsWithMalformedJsonNeverReturnServerError() {
        List<String> malformedBodies = List.of(
                "",
                "{",
                "}",
                "[]",
                "true",
                "null",
                "\"plain string\"",
                "{\"email\":}",
                "{\"email\":\"test@example.com\",\"password\":}",
                "{\"email\":\"test@example.com\",\"password\":\"password123\",}",
                "{\"email\": [1, 2, 3], \"password\": {\"nested\": true}}"
        );

        for (String body : malformedBodies) {
            assertNoServerError(postRawJson("/api/v1/auth/register", body));
            assertNoServerError(postRawJson("/api/v1/auth/login", body));
            assertNoServerError(postRawJson("/api/v1/auth/refresh", body));
            assertNoServerError(postRawJson("/api/v1/auth/logout", body));
        }
    }

    @Test
    void profileEndpointWithFuzzedPayloadsNeverReturnsServerError() {
        AuthResponse user = register("profile-fuzz@example.com", "password123", "Profile Fuzz");
        List<Map<String, Object>> payloads = List.of(
                mapOf("displayName", "", "avatarUrl", ""),
                mapOf("displayName", "   ", "avatarUrl", "   "),
                mapOf("displayName", fuzzString(255), "avatarUrl", "https://example.com/avatar.png"),
                mapOf("displayName", fuzzString(256), "avatarUrl", "https://example.com/avatar.png"),
                mapOf("displayName", "<script>alert(1)</script>", "avatarUrl", "javascript:alert(1)"),
                mapOf("displayName", "../../etc/passwd", "avatarUrl", "ftp://example.com/avatar.png"),
                mapOf("displayName", "Иван 🚀 测试", "avatarUrl", "https://example.com/аватар.png"),
                mapOf("displayName", null, "avatarUrl", null),
                mapOf("displayName", 12345, "avatarUrl", true),
                mapOf("unknown", List.of("value"))
        );

        for (Map<String, Object> payload : payloads) {
            ResponseEntity<String> response = restTemplate.exchange(
                    "/api/v1/users/me",
                    HttpMethod.PATCH,
                    authorizedEntity(user.accessToken(), payload),
                    String.class
            );

            assertNoServerError(response);
        }

        UserEntity savedUser = userRepository.findById(user.user().id()).orElseThrow();
        assertThat(savedUser.getEmail()).isEqualTo("profile-fuzz@example.com");
        assertThat(savedUser.getStatus()).isEqualTo(UserStatus.ACTIVE);
    }

    @Test
    void malformedAuthorizationHeadersNeverReturnServerError() {
        List<String> authorizationHeaders = List.of(
                "",
                "Bearer",
                "Bearer ",
                "Bearer not-a-jwt",
                "Bearer " + fuzzString(512),
                "Basic " + fuzzString(64),
                "Token " + UUID.randomUUID(),
                "' OR '1'='1",
                "<script>alert(1)</script>"
        );

        for (String authorizationHeader : authorizationHeaders) {
            HttpHeaders headers = new HttpHeaders();
            headers.set(HttpHeaders.AUTHORIZATION, authorizationHeader);

            ResponseEntity<String> response = restTemplate.exchange(
                    "/api/v1/users/me",
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    String.class
            );

            assertNoServerError(response);
            assertThat(response.getStatusCode().value()).isIn(400, 401, 403);
        }
    }

    @Test
    void adminEndpointsWithFuzzedPayloadsNeverReturnServerError() {
        UserEntity admin = createUser("admin-fuzz@example.com", "password123", UserRole.ADMIN, UserStatus.ACTIVE);
        UserEntity target = createUser("target-fuzz@example.com", "password123", UserRole.USER, UserStatus.ACTIVE);
        AuthResponse adminSession = login("admin-fuzz@example.com", "password123");

        List<Map<String, Object>> rolePayloads = List.of(
                mapOf("role", ""),
                mapOf("role", "OWNER"),
                mapOf("role", "admin"),
                mapOf("role", 123),
                mapOf("role", null),
                mapOf("role", List.of("ADMIN"))
        );

        for (Map<String, Object> payload : rolePayloads) {
            ResponseEntity<String> response = restTemplate.exchange(
                    "/api/v1/admin/users/{userId}/role",
                    HttpMethod.PATCH,
                    authorizedEntity(adminSession.accessToken(), payload),
                    String.class,
                    target.getId()
            );

            assertNoServerError(response);
        }

        List<Map<String, Object>> statusPayloads = List.of(
                mapOf("status", ""),
                mapOf("status", "SUSPENDED"),
                mapOf("status", "active"),
                mapOf("status", 123),
                mapOf("status", null),
                mapOf("status", Map.of("nested", true))
        );

        for (Map<String, Object> payload : statusPayloads) {
            ResponseEntity<String> response = restTemplate.exchange(
                    "/api/v1/admin/users/{userId}/status",
                    HttpMethod.PATCH,
                    authorizedEntity(adminSession.accessToken(), payload),
                    String.class,
                    target.getId()
            );

            assertNoServerError(response);
        }

        UserEntity reloadedAdmin = userRepository.findById(admin.getId()).orElseThrow();
        UserEntity reloadedTarget = userRepository.findById(target.getId()).orElseThrow();

        assertThat(reloadedAdmin.getRole()).isEqualTo(UserRole.ADMIN);
        assertThat(reloadedAdmin.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(reloadedTarget.getRole()).isEqualTo(UserRole.USER);
        assertThat(reloadedTarget.getStatus()).isEqualTo(UserStatus.ACTIVE);
    }

    @Test
    void randomGeneratedRegisterPayloadsNeverReturnServerError() {
        List<Map<String, Object>> generatedPayloads = new ArrayList<>();

        for (int index = 0; index < 50; index++) {
            generatedPayloads.add(mapOf(
                    "email", fuzzString(index),
                    "password", fuzzString(150 - index),
                    "displayName", fuzzString(index * 7)
            ));
        }

        for (Map<String, Object> payload : generatedPayloads) {
            assertNoServerError(postJson("/api/v1/auth/register", payload));
        }
    }

    private ResponseEntity<String> postJson(String path, Map<String, Object> payload) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return restTemplate.postForEntity(path, new HttpEntity<>(payload, headers), String.class);
    }

    private ResponseEntity<String> postRawJson(String path, String body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return restTemplate.postForEntity(path, new HttpEntity<>(body, headers), String.class);
    }

    private Map<String, Object> mapOf(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();

        for (int index = 0; index < values.length; index += 2) {
            result.put((String) values[index], values[index + 1]);
        }

        return result;
    }

    private void assertNoServerError(ResponseEntity<String> response) {
        HttpStatusCode statusCode = response.getStatusCode();
        assertThat(statusCode.is5xxServerError())
                .as("Unexpected 5xx response: status=%s body=%s", statusCode, response.getBody())
                .isFalse();
    }

    private String fuzzString(int length) {
        String alphabet = "abcXYZ012_-.@'\"<>/\\{}[]()=+;: Привет🚀\u0000";
        StringBuilder result = new StringBuilder(length);

        for (int index = 0; index < length; index++) {
            int charIndex = Math.floorMod(index * 31 + length * 17, alphabet.length());
            result.append(alphabet.charAt(charIndex));
        }

        return result.toString();
    }
}

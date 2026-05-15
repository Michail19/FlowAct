package com.ms.userservice.database;

import com.ms.userservice.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DatabaseConstraintsIntegrationTest extends AbstractIntegrationTest {

    @Test
    void flywayAppliesAllUserServiceMigrations() {
        Integer appliedMigrations = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE success = true",
                Integer.class
        );

        assertThat(appliedMigrations).isNotNull().isGreaterThanOrEqualTo(3);

        Integer usersTableExists = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*)
                        FROM information_schema.tables
                        WHERE table_schema = 'public'
                          AND table_name = 'users'
                        """,
                Integer.class
        );
        Integer refreshTokensTableExists = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*)
                        FROM information_schema.tables
                        WHERE table_schema = 'public'
                          AND table_name = 'refresh_tokens'
                        """,
                Integer.class
        );

        assertThat(usersTableExists).isEqualTo(1);
        assertThat(refreshTokensTableExists).isEqualTo(1);
    }

    @Test
    void databaseRejectsDuplicateEmailIgnoringCase() {
        jdbcTemplate.update(
                """
                        INSERT INTO users(id, email, password_hash, display_name, role, status, account_type)
                        VALUES (gen_random_uuid(), 'unique@example.com', 'hash', 'First', 'USER', 'ACTIVE', 'REGULAR')
                        """
        );

        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                        INSERT INTO users(id, email, password_hash, display_name, role, status, account_type)
                        VALUES (gen_random_uuid(), 'UNIQUE@example.com', 'hash', 'Second', 'USER', 'ACTIVE', 'REGULAR')
                        """
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void databaseRejectsInvalidUserRoleStatusAndAccountType() {
        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                        INSERT INTO users(id, email, password_hash, display_name, role, status, account_type)
                        VALUES (gen_random_uuid(), 'bad-role@example.com', 'hash', 'Bad Role', 'OWNER', 'ACTIVE', 'REGULAR')
                        """
        )).isInstanceOf(DataIntegrityViolationException.class);

        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                        INSERT INTO users(id, email, password_hash, display_name, role, status, account_type)
                        VALUES (gen_random_uuid(), 'bad-status@example.com', 'hash', 'Bad Status', 'USER', 'SUSPENDED', 'REGULAR')
                        """
        )).isInstanceOf(DataIntegrityViolationException.class);

        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                        INSERT INTO users(id, email, password_hash, display_name, role, status, account_type)
                        VALUES (gen_random_uuid(), 'bad-account-type@example.com', 'hash', 'Bad Type', 'USER', 'ACTIVE', 'TEMP')
                        """
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void databaseRejectsBlankEmailAndPasswordHash() {
        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                        INSERT INTO users(id, email, password_hash, display_name, role, status, account_type)
                        VALUES (gen_random_uuid(), '   ', 'hash', 'Blank Email', 'USER', 'ACTIVE', 'REGULAR')
                        """
        )).isInstanceOf(DataIntegrityViolationException.class);

        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                        INSERT INTO users(id, email, password_hash, display_name, role, status, account_type)
                        VALUES (gen_random_uuid(), 'blank-password@example.com', '   ', 'Blank Password', 'USER', 'ACTIVE', 'REGULAR')
                        """
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void databaseRejectsInvalidRefreshTokenRows() {
        jdbcTemplate.update(
                """
                        INSERT INTO users(id, email, password_hash, display_name, role, status, account_type)
                        VALUES ('11111111-1111-1111-1111-111111111111', 'token-owner@example.com', 'hash', 'Owner', 'USER', 'ACTIVE', 'REGULAR')
                        """
        );

        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                        INSERT INTO refresh_tokens(id, user_id, token_hash, expires_at)
                        VALUES (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '   ', NOW() + INTERVAL '1 day')
                        """
        )).isInstanceOf(DataIntegrityViolationException.class);

        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                        INSERT INTO refresh_tokens(id, user_id, token_hash, expires_at)
                        VALUES (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'hash', NOW() - INTERVAL '1 day')
                        """
        )).isInstanceOf(DataIntegrityViolationException.class);
    }
}

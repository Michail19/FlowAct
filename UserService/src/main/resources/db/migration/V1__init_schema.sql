CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- USERS
-- =========================================================
CREATE TABLE users (
                       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                       email VARCHAR(320) NOT NULL,
                       password_hash VARCHAR(255) NOT NULL,
                       display_name VARCHAR(255),
                       role VARCHAR(30) NOT NULL DEFAULT 'USER',
                       status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
                       last_login_at TIMESTAMPTZ,
                       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                       CONSTRAINT chk_users_role
                           CHECK (role IN ('USER', 'ADMIN')),

                       CONSTRAINT chk_users_status
                           CHECK (status IN ('ACTIVE', 'BLOCKED', 'DELETED')),

                       CONSTRAINT chk_users_email_not_blank
                           CHECK (LENGTH(TRIM(email)) > 0),

                       CONSTRAINT chk_users_password_hash_not_blank
                           CHECK (LENGTH(TRIM(password_hash)) > 0)
);

CREATE UNIQUE INDEX ux_users_email_lower
    ON users (LOWER(email));

CREATE INDEX idx_users_status
    ON users (status);

CREATE INDEX idx_users_role
    ON users (role);

CREATE INDEX idx_users_created_at
    ON users (created_at DESC);


-- =========================================================
-- REFRESH TOKENS
-- =========================================================
CREATE TABLE refresh_tokens (
                                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                user_id UUID NOT NULL,
                                token_hash VARCHAR(255) NOT NULL,
                                expires_at TIMESTAMPTZ NOT NULL,
                                revoked_at TIMESTAMPTZ,
                                revoked_reason VARCHAR(255),
                                replaced_by_token_id UUID,
                                user_agent TEXT,
                                ip_address VARCHAR(45),
                                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                                CONSTRAINT fk_refresh_tokens_user
                                    FOREIGN KEY (user_id)
                                        REFERENCES users(id)
                                        ON DELETE CASCADE,

                                CONSTRAINT fk_refresh_tokens_replaced_by_token
                                    FOREIGN KEY (replaced_by_token_id)
                                        REFERENCES refresh_tokens(id)
                                        ON DELETE SET NULL,

                                CONSTRAINT chk_refresh_tokens_token_hash_not_blank
                                    CHECK (LENGTH(TRIM(token_hash)) > 0),

                                CONSTRAINT chk_refresh_tokens_expiration
                                    CHECK (expires_at > created_at)
);

CREATE INDEX idx_refresh_tokens_user_id
    ON refresh_tokens (user_id);

CREATE INDEX idx_refresh_tokens_expires_at
    ON refresh_tokens (expires_at);

CREATE INDEX idx_refresh_tokens_created_at
    ON refresh_tokens (created_at DESC);

CREATE INDEX idx_refresh_tokens_user_active
    ON refresh_tokens (user_id, expires_at)
    WHERE revoked_at IS NULL;

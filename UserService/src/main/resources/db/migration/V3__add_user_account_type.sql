ALTER TABLE users
    ADD COLUMN account_type VARCHAR(30) NOT NULL DEFAULT 'REGULAR',
    ADD COLUMN demo_expires_at TIMESTAMPTZ;

ALTER TABLE users
    ADD CONSTRAINT chk_users_account_type
        CHECK (account_type IN ('REGULAR', 'DEMO'));

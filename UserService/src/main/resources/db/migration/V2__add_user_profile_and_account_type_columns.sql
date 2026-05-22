ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS account_type VARCHAR(30);

UPDATE users
SET account_type = 'REGULAR'
WHERE account_type IS NULL;

ALTER TABLE users
    ALTER COLUMN account_type SET DEFAULT 'REGULAR',
    ALTER COLUMN account_type SET NOT NULL;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS demo_expires_at TIMESTAMPTZ;

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS chk_users_account_type;

ALTER TABLE users
    ADD CONSTRAINT chk_users_account_type
        CHECK (account_type IN ('REGULAR', 'DEMO'));

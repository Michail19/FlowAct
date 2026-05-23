ALTER TABLE users
    ADD COLUMN IF NOT EXISTS username VARCHAR(64);

UPDATE users
SET username = LEFT(
    REGEXP_REPLACE(
        LOWER(SPLIT_PART(email, '@', 1)),
        '[^a-z0-9._-]',
        '',
        'g'
    ),
    64
)
WHERE username IS NULL OR BTRIM(username) = '';

UPDATE users
SET username = CONCAT('user-', SUBSTRING(id::text, 1, 8))
WHERE username IS NULL OR LENGTH(username) < 2;

ALTER TABLE users
    ALTER COLUMN avatar_url TYPE TEXT;

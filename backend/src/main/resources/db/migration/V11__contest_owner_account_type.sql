ALTER TABLE contests
    ADD COLUMN owner_account_type VARCHAR(16) NOT NULL DEFAULT 'USER' AFTER owner_id;

UPDATE contests c
SET owner_account_type = 'ADMIN'
WHERE NOT EXISTS (
        SELECT 1 FROM users u WHERE u.id = c.owner_id
    )
  AND EXISTS (
        SELECT 1 FROM admin_users a WHERE a.id = c.owner_id
    );

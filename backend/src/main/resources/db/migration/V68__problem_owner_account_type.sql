ALTER TABLE problems
    ADD COLUMN owner_account_type VARCHAR(16) NOT NULL DEFAULT 'USER' AFTER owner_id;

-- Students and guests cannot create problems. When an owner ID exists in both
-- account tables, that rule lets us safely recover admin-owned rows for those
-- collisions. Teacher collisions remain USER because teachers can create them.
UPDATE problems p
LEFT JOIN users u ON u.id = p.owner_id
LEFT JOIN admin_users au ON au.id = p.owner_id
SET p.owner_account_type = 'ADMIN'
WHERE au.id IS NOT NULL
  AND (u.id IS NULL OR u.role NOT IN ('TEACHER'));

CREATE INDEX idx_problems_owner_identity
    ON problems(owner_account_type, owner_id);

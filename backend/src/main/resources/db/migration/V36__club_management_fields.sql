SET @schema_name = DATABASE();

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'clubs'
          AND COLUMN_NAME = 'owner_id'
    ),
    'ALTER TABLE clubs ADD COLUMN owner_id BIGINT NULL COMMENT ''社团负责人用户ID'' AFTER description',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'clubs'
          AND COLUMN_NAME = 'join_enabled'
    ),
    'ALTER TABLE clubs ADD COLUMN join_enabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT ''是否允许申请加入'' AFTER owner_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'club_id'
    ),
    'ALTER TABLE users ADD COLUMN club_id BIGINT NULL COMMENT ''所属社团ID'' AFTER role',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS club_join_applications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    club_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    reason VARCHAR(500),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    handled_at DATETIME NULL,
    handled_by BIGINT NULL,
    KEY idx_club_join_applications_club_status (club_id, status, created_at),
    KEY idx_club_join_applications_user_status (user_id, status),
    CONSTRAINT fk_club_join_applications_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
    CONSTRAINT fk_club_join_applications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_club_join_applications_handler FOREIGN KEY (handled_by) REFERENCES users(id) ON DELETE SET NULL
);

UPDATE clubs c
SET c.owner_id = (
    SELECT cm.user_id
    FROM club_members cm
    WHERE cm.club_id = c.id AND cm.role = 'ADMIN'
    ORDER BY cm.joined_at ASC, cm.user_id ASC
    LIMIT 1
)
WHERE c.owner_id IS NULL;

UPDATE clubs
SET join_enabled = TRUE
WHERE join_enabled IS NULL;

UPDATE users u
SET u.club_id = (
    SELECT cm.club_id
    FROM club_members cm
    WHERE cm.user_id = u.id
    ORDER BY cm.joined_at DESC, cm.club_id DESC
    LIMIT 1
)
WHERE u.club_id IS NULL;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'clubs'
          AND CONSTRAINT_NAME = 'fk_clubs_owner'
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ),
    'ALTER TABLE clubs ADD CONSTRAINT fk_clubs_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'users'
          AND CONSTRAINT_NAME = 'fk_users_club'
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ),
    'ALTER TABLE users ADD CONSTRAINT fk_users_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'users'
          AND INDEX_NAME = 'idx_users_club_id'
    ),
    'ALTER TABLE users ADD INDEX idx_users_club_id (club_id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

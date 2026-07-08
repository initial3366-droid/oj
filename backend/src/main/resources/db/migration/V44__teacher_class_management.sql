SET @schema_name = DATABASE();

CREATE TABLE IF NOT EXISTS classes (
    id BIGINT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    teacher_id BIGINT NOT NULL,
    join_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    approval_required BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_classes_teacher (teacher_id),
    KEY idx_classes_created_at (created_at),
    CONSTRAINT fk_classes_teacher_user FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS class_members (
    class_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    source VARCHAR(32) NOT NULL DEFAULT 'APPLICATION',
    import_batch_id VARCHAR(64),
    profile_fields JSON,
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (class_id, user_id),
    KEY idx_class_members_user (user_id),
    KEY idx_class_members_class_joined (class_id, joined_at DESC),
    CONSTRAINT fk_class_members_class_room FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_class_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS class_join_applications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    class_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    reason VARCHAR(500),
    handled_by BIGINT,
    handled_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_class_join_applications_class_status (class_id, status, created_at),
    KEY idx_class_join_applications_user_status (user_id, status),
    CONSTRAINT fk_class_join_applications_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_class_join_applications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_class_join_applications_handler FOREIGN KEY (handled_by) REFERENCES users(id) ON DELETE SET NULL
);

SET @column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'class_id'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE users ADD COLUMN class_id BIGINT NULL COMMENT ''主班级ID'' AFTER club_id', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'users'
      AND INDEX_NAME = 'idx_users_class_id'
);
SET @sql := IF(@index_exists = 0, 'ALTER TABLE users ADD INDEX idx_users_class_id (class_id)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'users'
      AND CONSTRAINT_NAME = 'fk_users_class_room'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(@fk_exists = 0, 'ALTER TABLE users ADD CONSTRAINT fk_users_class_room FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO classes (id, name, description, teacher_id, join_enabled, approval_required, created_at, updated_at)
SELECT
    c.id,
    c.name,
    c.description,
    c.owner_id,
    COALESCE(c.join_enabled, TRUE),
    TRUE,
    c.created_at,
    c.updated_at
FROM clubs c
JOIN users u ON u.id = c.owner_id
WHERE c.owner_id IS NOT NULL
  AND u.role IN ('TEACHER', 'CLUB_ADMIN', 'STUDENT');

INSERT IGNORE INTO class_members (class_id, user_id, source, joined_at)
SELECT cm.club_id, cm.user_id, 'MIGRATED_CLUB', cm.joined_at
FROM club_members cm
JOIN classes cl ON cl.id = cm.club_id
JOIN users u ON u.id = cm.user_id
WHERE u.role IN ('STUDENT', 'TEACHER', 'CLUB_ADMIN', 'GUEST');

UPDATE users u
SET u.class_id = (
    SELECT cm.class_id
    FROM class_members cm
    WHERE cm.user_id = u.id
    ORDER BY cm.joined_at DESC, cm.class_id DESC
    LIMIT 1
)
WHERE u.class_id IS NULL
  AND EXISTS (SELECT 1 FROM class_members cm WHERE cm.user_id = u.id);

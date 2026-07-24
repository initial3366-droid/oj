SET @schema_name = DATABASE();

SET @column_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'announcements'
      AND COLUMN_NAME = 'is_pinned'
);
SET @sql := IF(@column_exists = 0,
    'ALTER TABLE announcements ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT FALSE COMMENT ''是否为首页置顶公告'' AFTER is_visible',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'announcements'
      AND INDEX_NAME = 'idx_pinned_visible_deleted'
);
SET @sql := IF(@index_exists = 0,
    'ALTER TABLE announcements ADD INDEX idx_pinned_visible_deleted (is_pinned, is_visible, is_deleted)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

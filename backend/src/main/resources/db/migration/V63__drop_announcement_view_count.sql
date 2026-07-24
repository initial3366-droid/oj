SET @schema_name = DATABASE();

SET @column_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'announcements'
      AND COLUMN_NAME = 'view_count'
);
SET @sql := IF(@column_exists > 0,
    'ALTER TABLE announcements DROP COLUMN view_count',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @schema_name = DATABASE();

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'admin_users'
          AND COLUMN_NAME = 'avatar_url'
    ),
    'ALTER TABLE admin_users ADD COLUMN avatar_url VARCHAR(512) NULL COMMENT ''管理员头像 COS 公开访问地址'' AFTER display_name',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @schema_name = DATABASE();

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contests'
          AND COLUMN_NAME = 'allow_view_all_submissions'
    ),
    'ALTER TABLE contests ADD COLUMN allow_view_all_submissions BOOLEAN NOT NULL DEFAULT TRUE COMMENT ''比赛期间是否允许参赛者查看所有提交状态'' AFTER allow_star_registration',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

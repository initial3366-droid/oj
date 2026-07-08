SET @schema_name = DATABASE();

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contests'
          AND COLUMN_NAME = 'allow_after_end_view_code'
    ),
    'ALTER TABLE contests ADD COLUMN allow_after_end_view_code BOOLEAN NOT NULL DEFAULT FALSE COMMENT ''比赛结束后是否允许参赛者查看他人代码'' AFTER allow_after_end_view_problem',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

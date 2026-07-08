SET @schema_name = DATABASE();

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contests'
          AND COLUMN_NAME = 'allow_after_end_view_problem'
    ),
    'ALTER TABLE contests ADD COLUMN allow_after_end_view_problem BOOLEAN NOT NULL DEFAULT TRUE COMMENT ''比赛结束后是否允许查看题目'' AFTER allow_after_end_submit',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contests'
          AND COLUMN_NAME = 'public_scoreboard_enabled'
    ),
    'ALTER TABLE contests ADD COLUMN public_scoreboard_enabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT ''是否开启公共榜单'' AFTER allow_after_end_view_problem',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

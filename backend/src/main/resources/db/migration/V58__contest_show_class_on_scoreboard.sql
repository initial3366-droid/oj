SET @schema_name = DATABASE();

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contests'
          AND COLUMN_NAME = 'show_class_on_scoreboard'
    ),
    'ALTER TABLE contests ADD COLUMN show_class_on_scoreboard BOOLEAN NOT NULL DEFAULT FALSE COMMENT ''榜单是否显示班级'' AFTER public_scoreboard_enabled',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

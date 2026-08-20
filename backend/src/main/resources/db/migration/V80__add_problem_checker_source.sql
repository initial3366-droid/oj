SET @column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'problems'
      AND COLUMN_NAME = 'checker_source'
);

SET @sql := IF(
    @column_exists = 0,
    'ALTER TABLE problems ADD COLUMN checker_source LONGTEXT NULL AFTER output_format',
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

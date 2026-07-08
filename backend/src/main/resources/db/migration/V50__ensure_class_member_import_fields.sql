SET @schema_name = DATABASE();

SET @column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'class_members'
      AND COLUMN_NAME = 'source'
);
SET @sql := IF(@column_exists = 0,
    'ALTER TABLE class_members ADD COLUMN source VARCHAR(32) NOT NULL DEFAULT ''APPLICATION'' AFTER user_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'class_members'
      AND COLUMN_NAME = 'import_batch_id'
);
SET @sql := IF(@column_exists = 0,
    'ALTER TABLE class_members ADD COLUMN import_batch_id VARCHAR(64) NULL AFTER source',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'class_members'
      AND COLUMN_NAME = 'profile_fields'
);
SET @sql := IF(@column_exists = 0,
    'ALTER TABLE class_members ADD COLUMN profile_fields JSON NULL AFTER import_batch_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

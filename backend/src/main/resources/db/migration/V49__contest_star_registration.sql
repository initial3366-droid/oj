SET @schema_name = DATABASE();

SET @column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'contests'
      AND COLUMN_NAME = 'allow_star_registration'
);
SET @sql := IF(@column_exists = 0,
    'ALTER TABLE contests ADD COLUMN allow_star_registration BOOLEAN NOT NULL DEFAULT FALSE COMMENT ''是否允许打星报名'' AFTER public_scoreboard_enabled',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'contest_registrations'
      AND COLUMN_NAME = 'starred'
);
SET @sql := IF(@column_exists = 0,
    'ALTER TABLE contest_registrations ADD COLUMN starred BOOLEAN NOT NULL DEFAULT FALSE COMMENT ''是否打星报名'' AFTER identity_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'contest_participants'
      AND COLUMN_NAME = 'starred'
);
SET @sql := IF(@column_exists = 0,
    'ALTER TABLE contest_participants ADD COLUMN starred BOOLEAN NOT NULL DEFAULT FALSE COMMENT ''是否打星参赛'' AFTER identity_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

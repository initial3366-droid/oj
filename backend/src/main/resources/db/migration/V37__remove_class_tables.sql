SET @schema_name = DATABASE();

UPDATE contests
SET audience = 'ALL', audience_id = NULL
WHERE audience = 'CLASS';

UPDATE practices
SET audience = 'ALL', audience_id = NULL
WHERE audience = 'CLASS';

DELETE FROM contest_audiences
WHERE audience_type = 'CLASS';

UPDATE contest_registrations
SET identity_type = 'PERSONAL', identity_id = user_id
WHERE identity_type = 'CLASS';

UPDATE contest_participants
SET identity_type = 'PERSONAL', identity_id = user_id
WHERE identity_type = 'CLASS';

UPDATE submissions
SET identity_type = 'PERSONAL', identity_id = user_id
WHERE identity_type = 'CLASS';

SET @fk_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'class_members'
      AND CONSTRAINT_NAME = 'fk_class_members_class'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(@fk_exists > 0, 'ALTER TABLE class_members DROP FOREIGN KEY fk_class_members_class', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'class_members'
      AND CONSTRAINT_NAME = 'fk_class_members_user'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(@fk_exists > 0, 'ALTER TABLE class_members DROP FOREIGN KEY fk_class_members_user', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'classes'
      AND CONSTRAINT_NAME = 'fk_classes_teacher'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(@fk_exists > 0, 'ALTER TABLE classes DROP FOREIGN KEY fk_classes_teacher', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'contest_participants'
      AND COLUMN_NAME = 'class_id'
);
SET @sql := IF(@column_exists > 0, 'ALTER TABLE contest_participants DROP COLUMN class_id', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DROP TABLE IF EXISTS class_members;
DROP TABLE IF EXISTS classes;

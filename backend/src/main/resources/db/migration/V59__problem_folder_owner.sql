-- Track the creator/owner of problem folders so teacher views only show folders created by that teacher.
SET @column_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_folders' AND COLUMN_NAME = 'owner_id'
);
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE problem_folders ADD COLUMN owner_id BIGINT NULL AFTER display_order',
    'SELECT "owner_id column already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_folders' AND INDEX_NAME = 'idx_problem_folders_owner'
);
SET @sql = IF(@index_exists = 0,
    'CREATE INDEX idx_problem_folders_owner ON problem_folders(owner_id)',
    'SELECT "idx_problem_folders_owner already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

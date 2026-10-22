-- Route unfinished submissions from the retired contest worker back through
-- the built-in judge before removing the persisted backend-selection columns.
UPDATE submissions
SET status = 'WAITING',
    judge_worker_id = NULL,
    judge_server = NULL,
    judge_start_time = NULL,
    judge_end_time = NULL,
    judge_message = NULL,
    error_message = NULL,
    score = NULL,
    time_used = NULL,
    memory_used = NULL,
    updated_at = NOW()
WHERE judge_backend = 'CCPCOJ'
  AND status IN ('WAITING', 'PENDING', 'REJUDGE_PENDING', 'JUDGING', 'COMPILING', 'RUNNING');

UPDATE submissions
SET judge_server = 'LEGACY'
WHERE UPPER(COALESCE(judge_server, '')) = 'CCPCOJ';

-- Keep the existing stale-task timeout while moving it to a backend-neutral key.
INSERT INTO system_settings (setting_key, setting_value, category, description, updated_at, updated_by)
SELECT 'judge.stale_task_minutes', setting_value, 'judge', 'go-judge 失联任务重新领取时间（分钟）', NOW(), 'flyway-v99'
FROM system_settings
WHERE setting_key = 'judge.ccpcoj_stale_task_minutes'
ON DUPLICATE KEY UPDATE
    setting_value = VALUES(setting_value),
    description = VALUES(description),
    updated_at = VALUES(updated_at),
    updated_by = VALUES(updated_by);

DELETE FROM system_settings
WHERE setting_key IN (
    'judge.ccpcoj_username',
    'judge.ccpcoj_password_hash',
    'judge.ccpcoj_session_ttl_minutes',
    'judge.ccpcoj_stale_task_minutes',
    'judge.contest_mode',
    'judge.mode'
);

SET @schema_name = DATABASE();

SET @constraint_exists := (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = @schema_name
      AND TABLE_NAME = 'contests'
      AND CONSTRAINT_NAME = 'chk_contests_judge_mode'
      AND CONSTRAINT_TYPE = 'CHECK'
);
SET @sql := IF(@constraint_exists > 0,
    'ALTER TABLE contests DROP CHECK chk_contests_judge_mode',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'submissions'
      AND INDEX_NAME = 'idx_submissions_judge_backend_status'
);
SET @sql := IF(@index_exists > 0,
    'ALTER TABLE submissions DROP INDEX idx_submissions_judge_backend_status',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists := (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = @schema_name
      AND TABLE_NAME = 'submissions'
      AND CONSTRAINT_NAME = 'chk_submissions_judge_backend'
      AND CONSTRAINT_TYPE = 'CHECK'
);
SET @sql := IF(@constraint_exists > 0,
    'ALTER TABLE submissions DROP CHECK chk_submissions_judge_backend',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'contests'
      AND COLUMN_NAME = 'judge_mode'
);
SET @sql := IF(@column_exists > 0,
    'ALTER TABLE contests DROP COLUMN judge_mode',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'submissions'
      AND COLUMN_NAME = 'judge_backend'
);
SET @sql := IF(@column_exists > 0,
    'ALTER TABLE submissions DROP COLUMN judge_backend',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

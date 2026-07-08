SET @schema_name = DATABASE();

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'submissions'
          AND COLUMN_NAME = 'judge_start_time'
    ),
    'ALTER TABLE submissions ADD COLUMN judge_start_time DATETIME NULL COMMENT ''判题开始时间'' AFTER submit_time',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'submissions'
          AND COLUMN_NAME = 'judge_end_time'
    ),
    'ALTER TABLE submissions ADD COLUMN judge_end_time DATETIME NULL COMMENT ''判题结束时间'' AFTER judge_start_time',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'submissions'
          AND COLUMN_NAME = 'judge_message'
    ),
    'ALTER TABLE submissions ADD COLUMN judge_message TEXT NULL COMMENT ''判题信息'' AFTER is_rejudged',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'submissions'
          AND COLUMN_NAME = 'judge_server'
    ),
    'ALTER TABLE submissions ADD COLUMN judge_server VARCHAR(100) NULL COMMENT ''判题机标识'' AFTER domjudge_submission_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'submissions'
          AND COLUMN_NAME = 'priority'
    ),
    'ALTER TABLE submissions ADD COLUMN priority INT NOT NULL DEFAULT 0 COMMENT ''队列优先级'' AFTER judge_server',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'submissions'
          AND COLUMN_NAME = 'retry_count'
    ),
    'ALTER TABLE submissions ADD COLUMN retry_count INT NOT NULL DEFAULT 0 COMMENT ''重试次数'' AFTER priority',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'submissions'
          AND COLUMN_NAME = 'error_message'
    ),
    'ALTER TABLE submissions ADD COLUMN error_message TEXT NULL COMMENT ''队列错误信息'' AFTER retry_count',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE submissions
SET submit_time = created_at
WHERE submit_time IS NULL;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'submissions'
          AND INDEX_NAME = 'idx_submission_queue_status_time'
    ),
    'ALTER TABLE submissions ADD INDEX idx_submission_queue_status_time (status, priority, submit_time)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'submissions'
          AND INDEX_NAME = 'idx_submission_queue_filters'
    ),
    'ALTER TABLE submissions ADD INDEX idx_submission_queue_filters (contest_id, problem_id, user_id, language, judge_server)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

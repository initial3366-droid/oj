-- V31: Judge queue scheduling fields and indexes
-- Add judge_worker_id column for tracking which worker is processing a submission

SET @schema_name = DATABASE();

-- 1. Add judge_worker_id column
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'submissions'
          AND COLUMN_NAME = 'judge_worker_id'
    ),
    'ALTER TABLE submissions ADD COLUMN judge_worker_id VARCHAR(100) NULL COMMENT ''判题工作线程标识'' AFTER judge_server',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Add index for efficient queue polling (WAITING/PENDING/REJUDGE_PENDING ordered by submit_time)
-- This is critical for the JudgeQueueScheduler to quickly find pending submissions
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'submissions'
          AND INDEX_NAME = 'idx_submission_status_submit'
    ),
    'ALTER TABLE submissions ADD INDEX idx_submission_status_submit (status ASC, priority DESC, submit_time ASC)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Add index for querying currently running/judging submissions
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'submissions'
          AND INDEX_NAME = 'idx_submission_worker'
    ),
    'ALTER TABLE submissions ADD INDEX idx_submission_worker (judge_worker_id, status)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


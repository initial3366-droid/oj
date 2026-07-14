-- Replace the retired remote judge integration with the CCPCOJ pull-based judge gateway.

UPDATE system_settings
SET setting_value = 'ccpcoj',
    description = CASE setting_key
        WHEN 'judge.mode' THEN '判题模式：ccpcoj、docker、unsafe-local'
        ELSE '比赛判题模式：ccpcoj、docker、unsafe-local'
    END,
    updated_at = NOW()
WHERE setting_key IN ('judge.mode', 'judge.contest_mode')
  AND LOWER(setting_value) = 'domjudge';

DELETE FROM system_settings
WHERE setting_key IN (
    'judge.domjudge_base_url',
    'judge.domjudge_api_key',
    'judge.domjudge_contest_id',
    'judge.domjudge_poll_interval_ms'
);

INSERT INTO system_settings (setting_key, setting_value, category, description, updated_at)
VALUES
    ('judge.ccpcoj_username', 'judger', 'judge', 'CCPCOJ 评测机账号', NOW()),
    ('judge.ccpcoj_password_hash', '', 'judge', 'CCPCOJ 评测机密码哈希', NOW()),
    ('judge.ccpcoj_session_ttl_minutes', '720', 'judge', 'CCPCOJ 评测机会话有效期（分钟）', NOW()),
    ('judge.ccpcoj_stale_task_minutes', '15', 'judge', 'CCPCOJ 失联任务重新领取时间（分钟）', NOW())
ON DUPLICATE KEY UPDATE setting_key = setting_key;

SET @index_exists := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'submissions'
      AND INDEX_NAME = 'idx_submissions_domjudge_submission_id'
);
SET @sql := IF(
    @index_exists > 0,
    'ALTER TABLE submissions DROP INDEX idx_submissions_domjudge_submission_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'submissions'
      AND COLUMN_NAME = 'domjudge_submission_id'
);
SET @sql := IF(
    @column_exists > 0,
    'ALTER TABLE submissions DROP COLUMN domjudge_submission_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'problems'
      AND COLUMN_NAME = 'domjudge_problem_id'
);
SET @sql := IF(
    @column_exists > 0,
    'ALTER TABLE problems DROP COLUMN domjudge_problem_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'contest_problems'
      AND COLUMN_NAME = 'domjudge_problem_id'
);
SET @sql := IF(
    @column_exists > 0,
    'ALTER TABLE contest_problems DROP COLUMN domjudge_problem_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

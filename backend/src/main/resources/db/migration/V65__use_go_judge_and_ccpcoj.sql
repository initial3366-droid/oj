-- Ordinary problem/practice submissions use the embedded go-judge adapter.
-- Contest submissions remain owned by the CCPCOJ pull gateway.
INSERT INTO system_settings (setting_key, setting_value, category, description, updated_at)
VALUES
    ('judge.mode', 'go-judge', 'judge', '普通题库与练习判题服务：go-judge', NOW()),
    ('judge.contest_mode', 'ccpcoj', 'judge', '比赛判题服务：CCPCOJ', NOW())
ON DUPLICATE KEY UPDATE
    setting_value = VALUES(setting_value),
    description = VALUES(description),
    updated_at = NOW();

-- Endpoint credentials are environment-only; obsolete modes and secrets must not remain in the database.
DELETE FROM system_settings
WHERE setting_key IN (
    'judge.enable_unsafe_local_judge',
    'judge.domjudge_base_url',
    'judge.domjudge_api_key',
    'judge.domjudge_contest_id',
    'judge.domjudge_poll_interval_ms'
);

-- Preserve historical audit meaning without retaining retired implementation names.
UPDATE submissions
SET judge_server = 'LEGACY'
WHERE UPPER(COALESCE(judge_server, '')) IN ('DOMJUDGE', 'DOCKER', 'LOCAL');

-- V64 already performs these drops. Repeating them conditionally makes upgrades
-- safe for installations that skipped the retired CCPCOJ migration branch.
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

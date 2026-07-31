-- Each contest owns its judge choice. Existing contests keep the previous
-- CCPCOJ behavior, while contests created after this migration default to go-judge.
-- MySQL DDL is not transactional, so every structural step is restart-safe if
-- an operator has to repair and rerun a partially applied Flyway migration.
SET @schema_name = DATABASE();

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contests'
          AND COLUMN_NAME = 'judge_mode'
    ),
    'ALTER TABLE contests ADD COLUMN judge_mode VARCHAR(20) NULL COMMENT ''GO_JUDGE or CCPCOJ'' AFTER scoring_mode',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE contests
SET judge_mode = 'CCPCOJ'
WHERE judge_mode IS NULL;

ALTER TABLE contests
    MODIFY COLUMN judge_mode VARCHAR(20) NOT NULL DEFAULT 'GO_JUDGE'
        COMMENT 'GO_JUDGE or CCPCOJ';

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = @schema_name
          AND TABLE_NAME = 'contests'
          AND CONSTRAINT_NAME = 'chk_contests_judge_mode'
          AND CONSTRAINT_TYPE = 'CHECK'
    ),
    'ALTER TABLE contests ADD CONSTRAINT chk_contests_judge_mode CHECK (judge_mode IN (''GO_JUDGE'', ''CCPCOJ''))',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Snapshot routing on submission creation so later configuration changes can
-- never move an existing task between workers or cause both workers to claim it.
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'submissions'
          AND COLUMN_NAME = 'judge_backend'
    ),
    'ALTER TABLE submissions ADD COLUMN judge_backend VARCHAR(20) NULL COMMENT ''Immutable judge routing snapshot'' AFTER judge_server',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE submissions s
LEFT JOIN contests c ON c.id = s.contest_id
SET s.judge_backend = CASE
    WHEN s.contest_id IS NULL THEN 'GO_JUDGE'
    ELSE COALESCE(c.judge_mode, 'CCPCOJ')
END
WHERE s.judge_backend IS NULL;

ALTER TABLE submissions
    MODIFY COLUMN judge_backend VARCHAR(20) NOT NULL DEFAULT 'GO_JUDGE'
        COMMENT 'Immutable judge routing snapshot';

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = @schema_name
          AND TABLE_NAME = 'submissions'
          AND CONSTRAINT_NAME = 'chk_submissions_judge_backend'
          AND CONSTRAINT_TYPE = 'CHECK'
    ),
    'ALTER TABLE submissions ADD CONSTRAINT chk_submissions_judge_backend CHECK (judge_backend IN (''GO_JUDGE'', ''CCPCOJ''))',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'submissions'
          AND INDEX_NAME = 'idx_submissions_judge_backend_status'
    ),
    'CREATE INDEX idx_submissions_judge_backend_status ON submissions (judge_backend, status, priority, submit_time)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO system_settings (setting_key, setting_value, category, description, updated_at, updated_by)
VALUES (
    'judge.contest_mode',
    'per-contest',
    'judge',
    '比赛判题服务由每场比赛的 judge_mode 决定',
    NOW(),
    'flyway-v66'
)
ON DUPLICATE KEY UPDATE
    setting_value = VALUES(setting_value),
    description = VALUES(description),
    updated_at = VALUES(updated_at),
    updated_by = VALUES(updated_by);

SET @schema_name = DATABASE();

SET @sql = IF(
    EXISTS (
        SELECT 1
        FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_problems'
          AND CONSTRAINT_NAME = 'fk_contest_problems_problem'
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ),
    'ALTER TABLE contest_problems DROP FOREIGN KEY fk_contest_problems_problem',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    EXISTS (
        SELECT 1
        FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_problem_case_scores'
          AND CONSTRAINT_NAME = 'fk_contest_case_scores_problem'
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ),
    'ALTER TABLE contest_problem_case_scores DROP FOREIGN KEY fk_contest_case_scores_problem',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_registrations'
          AND COLUMN_NAME = 'identity_type'
    ),
    'ALTER TABLE contest_registrations ADD COLUMN identity_type VARCHAR(16) NULL AFTER user_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_registrations'
          AND COLUMN_NAME = 'identity_id'
    ),
    'ALTER TABLE contest_registrations ADD COLUMN identity_id BIGINT NULL AFTER identity_type',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE contest_registrations
SET identity_type = 'PERSONAL'
WHERE identity_type IS NULL
   OR identity_type = '';

UPDATE contest_registrations
SET identity_id = user_id
WHERE identity_id IS NULL;

ALTER TABLE contest_registrations
    MODIFY identity_type VARCHAR(16) NOT NULL,
    MODIFY identity_id BIGINT NOT NULL;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_problems'
          AND COLUMN_NAME = 'id'
    ),
    'ALTER TABLE contest_problems ADD COLUMN id BIGINT NOT NULL AUTO_INCREMENT UNIQUE FIRST',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_problems'
          AND COLUMN_NAME = 'title'
    ),
    'ALTER TABLE contest_problems ADD COLUMN title VARCHAR(200) NULL AFTER display_order',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_problems'
          AND COLUMN_NAME = 'statement'
    ),
    'ALTER TABLE contest_problems ADD COLUMN statement LONGTEXT NULL AFTER title',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_problems'
          AND COLUMN_NAME = 'input_format'
    ),
    'ALTER TABLE contest_problems ADD COLUMN input_format TEXT NULL AFTER statement',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_problems'
          AND COLUMN_NAME = 'output_format'
    ),
    'ALTER TABLE contest_problems ADD COLUMN output_format TEXT NULL AFTER input_format',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_problems'
          AND COLUMN_NAME = 'sample_cases'
    ),
    'ALTER TABLE contest_problems ADD COLUMN sample_cases JSON NULL AFTER output_format',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_problems'
          AND COLUMN_NAME = 'time_limit'
    ),
    'ALTER TABLE contest_problems ADD COLUMN time_limit INT NULL AFTER sample_cases',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_problems'
          AND COLUMN_NAME = 'memory_limit'
    ),
    'ALTER TABLE contest_problems ADD COLUMN memory_limit INT NULL AFTER time_limit',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_problems'
          AND COLUMN_NAME = 'difficulty'
    ),
    'ALTER TABLE contest_problems ADD COLUMN difficulty TINYINT NULL AFTER memory_limit',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_problems'
          AND COLUMN_NAME = 'tags'
    ),
    'ALTER TABLE contest_problems ADD COLUMN tags JSON NULL AFTER difficulty',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_problems'
          AND COLUMN_NAME = 'domjudge_problem_id'
    ),
    'ALTER TABLE contest_problems ADD COLUMN domjudge_problem_id VARCHAR(50) NULL AFTER tags',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_problems'
          AND COLUMN_NAME = 'created_at'
    ),
    'ALTER TABLE contest_problems ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER domjudge_problem_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_problems'
          AND COLUMN_NAME = 'updated_at'
    ),
    'ALTER TABLE contest_problems ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE contest_problems cp
JOIN problems p ON p.id = cp.problem_id
SET cp.title = COALESCE(cp.title, p.title),
    cp.statement = COALESCE(cp.statement, p.statement),
    cp.input_format = COALESCE(cp.input_format, p.input_format),
    cp.output_format = COALESCE(cp.output_format, p.output_format),
    cp.sample_cases = COALESCE(cp.sample_cases, p.sample_cases),
    cp.time_limit = COALESCE(cp.time_limit, p.time_limit),
    cp.memory_limit = COALESCE(cp.memory_limit, p.memory_limit),
    cp.difficulty = COALESCE(cp.difficulty, p.difficulty),
    cp.tags = COALESCE(cp.tags, p.tags),
    cp.domjudge_problem_id = COALESCE(cp.domjudge_problem_id, p.domjudge_problem_id);

UPDATE contest_problems
SET title = COALESCE(title, CONCAT('题目 ', problem_id)),
    statement = COALESCE(statement, ''),
    time_limit = COALESCE(time_limit, 1000),
    memory_limit = COALESCE(memory_limit, 256),
    difficulty = COALESCE(difficulty, 1);

ALTER TABLE contest_problems
    MODIFY title VARCHAR(200) NOT NULL,
    MODIFY statement LONGTEXT NOT NULL,
    MODIFY time_limit INT NOT NULL,
    MODIFY memory_limit INT NOT NULL;

CREATE TABLE IF NOT EXISTS contest_problem_test_cases (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    contest_problem_id BIGINT NOT NULL,
    case_no INT NOT NULL,
    input_data LONGTEXT NOT NULL,
    output_data LONGTEXT NOT NULL,
    explanation TEXT,
    sample BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_contest_problem_case (contest_problem_id, sample, case_no),
    KEY idx_contest_problem_cases_problem (contest_problem_id),
    CONSTRAINT fk_contest_problem_cases_problem FOREIGN KEY (contest_problem_id) REFERENCES contest_problems(id)
);

INSERT IGNORE INTO contest_problem_test_cases (
    contest_problem_id,
    case_no,
    input_data,
    output_data,
    explanation,
    sample,
    created_at,
    updated_at
)
SELECT
    cp.id,
    ptc.case_no,
    ptc.input_data,
    ptc.output_data,
    ptc.explanation,
    ptc.sample,
    ptc.created_at,
    ptc.updated_at
FROM contest_problems cp
JOIN problem_test_cases ptc ON ptc.problem_id = cp.problem_id;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'submissions'
          AND COLUMN_NAME = 'contest_problem_id'
    ),
    'ALTER TABLE submissions ADD COLUMN contest_problem_id BIGINT NULL AFTER contest_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE submissions s
JOIN contest_problems cp
  ON cp.contest_id = s.contest_id
 AND cp.problem_id = s.problem_id
SET s.contest_problem_id = cp.id
WHERE s.contest_id IS NOT NULL
  AND s.contest_problem_id IS NULL;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'submissions'
          AND INDEX_NAME = 'idx_submissions_contest_problem'
    ),
    'ALTER TABLE submissions ADD KEY idx_submissions_contest_problem (contest_id, contest_problem_id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

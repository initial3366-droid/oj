SET @schema_name = DATABASE();

UPDATE contest_registrations
SET identity_type = 'PERSONAL'
WHERE identity_type IS NULL
   OR identity_type = '';

UPDATE contest_registrations
SET identity_id = user_id
WHERE identity_id IS NULL;

CREATE TEMPORARY TABLE tmp_contest_registrations AS
SELECT
    contest_id,
    user_id,
    SUBSTRING_INDEX(GROUP_CONCAT(identity_type ORDER BY registered_at DESC), ',', 1) AS identity_type,
    CAST(SUBSTRING_INDEX(GROUP_CONCAT(identity_id ORDER BY registered_at DESC), ',', 1) AS UNSIGNED) AS identity_id,
    MAX(registered_at) AS registered_at
FROM contest_registrations
GROUP BY contest_id, user_id;

DELETE FROM contest_registrations;

INSERT INTO contest_registrations (
    contest_id,
    user_id,
    identity_type,
    identity_id,
    registered_at
)
SELECT
    contest_id,
    user_id,
    identity_type,
    identity_id,
    registered_at
FROM tmp_contest_registrations;

DROP TEMPORARY TABLE tmp_contest_registrations;

SET @registration_pair_unique_exists = (
    SELECT COUNT(*)
    FROM (
        SELECT
            INDEX_NAME,
            GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS indexed_columns
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_registrations'
          AND NON_UNIQUE = 0
        GROUP BY INDEX_NAME
    ) indexes
    WHERE indexed_columns = 'contest_id,user_id'
);

SET @sql = IF(
    @registration_pair_unique_exists = 0,
    'ALTER TABLE contest_registrations ADD UNIQUE KEY uk_contest_registrations_contest_user (contest_id, user_id)',
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
  AND (s.contest_problem_id IS NULL OR s.contest_problem_id = 0);

CREATE TEMPORARY TABLE tmp_contest_problem_case_scores AS
SELECT
    cps.contest_id,
    COALESCE(source_problem.id, snapshot_problem.id, cps.problem_id) AS problem_id,
    cps.case_no,
    MAX(cps.score) AS score,
    MIN(cps.created_at) AS created_at,
    MAX(cps.updated_at) AS updated_at
FROM contest_problem_case_scores cps
LEFT JOIN contest_problems source_problem
  ON source_problem.contest_id = cps.contest_id
 AND source_problem.problem_id = cps.problem_id
LEFT JOIN contest_problems snapshot_problem
  ON snapshot_problem.contest_id = cps.contest_id
 AND snapshot_problem.id = cps.problem_id
GROUP BY
    cps.contest_id,
    COALESCE(source_problem.id, snapshot_problem.id, cps.problem_id),
    cps.case_no;

DELETE FROM contest_problem_case_scores;

INSERT INTO contest_problem_case_scores (
    contest_id,
    problem_id,
    case_no,
    score,
    created_at,
    updated_at
)
SELECT
    contest_id,
    problem_id,
    case_no,
    score,
    created_at,
    updated_at
FROM tmp_contest_problem_case_scores;

DROP TEMPORARY TABLE tmp_contest_problem_case_scores;

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
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_problems'
          AND INDEX_NAME = 'idx_contest_problems_contest_snapshot'
    ),
    'ALTER TABLE contest_problems ADD KEY idx_contest_problems_contest_snapshot (contest_id, id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_problem_case_scores'
          AND INDEX_NAME = 'idx_contest_case_scores_snapshot_problem'
    ),
    'ALTER TABLE contest_problem_case_scores ADD KEY idx_contest_case_scores_snapshot_problem (contest_id, problem_id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

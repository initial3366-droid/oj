SET @column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'contest_problems'
      AND COLUMN_NAME = 'checker_source'
);

SET @sql := IF(
    @column_exists = 0,
    'ALTER TABLE contest_problems ADD COLUMN checker_source LONGTEXT NULL AFTER output_format',
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE contest_problems AS contest_problem
JOIN problems AS source_problem ON source_problem.id = contest_problem.problem_id
SET contest_problem.checker_source = source_problem.checker_source
WHERE contest_problem.checker_source IS NULL;

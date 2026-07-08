SET @schema_name = DATABASE();

SET @fk_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'home_daily_problem_config'
      AND CONSTRAINT_NAME = 'fk_home_daily_problem_problem'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(@fk_exists > 0, 'ALTER TABLE home_daily_problem_config DROP FOREIGN KEY fk_home_daily_problem_problem', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DROP TABLE IF EXISTS home_daily_problem_config;

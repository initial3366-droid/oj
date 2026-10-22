ALTER TABLE problem_solution_progress
    ADD COLUMN current_level INT NOT NULL DEFAULT 1 AFTER viewed_level;

UPDATE problem_solution_progress
SET current_level = GREATEST(1, viewed_level);

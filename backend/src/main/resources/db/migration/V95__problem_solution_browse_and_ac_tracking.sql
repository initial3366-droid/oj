ALTER TABLE problem_solution_progress
    ADD COLUMN viewed_level INT NOT NULL DEFAULT 1 AFTER completed_level;

CREATE TABLE problem_solution_level_ac (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    problem_id BIGINT NOT NULL,
    account_type VARCHAR(16) NOT NULL,
    user_id BIGINT NOT NULL,
    level_no INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_problem_solution_level_ac_user (problem_id, account_type, user_id, level_no),
    INDEX idx_problem_solution_level_ac_count (problem_id, level_no, account_type),
    CONSTRAINT fk_problem_solution_level_ac_problem FOREIGN KEY (problem_id)
        REFERENCES problems(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO problem_solution_level_ac (problem_id, account_type, user_id, level_no)
SELECT progress.problem_id, progress.account_type, progress.user_id, node.level_no
FROM problem_solution_progress progress
JOIN problem_solution_nodes node ON node.problem_id = progress.problem_id
WHERE node.level_no <= progress.completed_level;

UPDATE problem_solution_progress progress
LEFT JOIN (
    SELECT problem_id, COUNT(*) AS height
    FROM problem_solution_nodes
    GROUP BY problem_id
) levels ON levels.problem_id = progress.problem_id
SET progress.viewed_level = CASE
    WHEN COALESCE(levels.height, 0) = 0 THEN 1
    WHEN progress.completed_level >= levels.height THEN levels.height
    ELSE GREATEST(1, progress.completed_level + 1)
END;

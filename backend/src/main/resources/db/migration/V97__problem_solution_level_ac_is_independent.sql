DELETE accepted
FROM problem_solution_level_ac accepted
JOIN problem_solution_progress progress
    ON progress.problem_id = accepted.problem_id
   AND progress.account_type = accepted.account_type
   AND progress.user_id = accepted.user_id
WHERE progress.completed_level > accepted.level_no;

INSERT IGNORE INTO problem_solution_level_ac (problem_id, account_type, user_id, level_no)
SELECT progress.problem_id, progress.account_type, progress.user_id, progress.completed_level
FROM problem_solution_progress progress
JOIN problem_solution_nodes node
    ON node.problem_id = progress.problem_id
   AND node.level_no = progress.completed_level
WHERE progress.completed_level > 0;

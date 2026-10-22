DELETE accepted
FROM problem_solution_level_ac accepted
JOIN (
    SELECT id
    FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY problem_id, account_type, user_id
            ORDER BY created_at, id
        ) AS sequence_no
        FROM problem_solution_level_ac
    ) ranked
    WHERE sequence_no > 1
) duplicate ON duplicate.id = accepted.id;

ALTER TABLE problem_solution_level_ac
    DROP INDEX uk_problem_solution_level_ac_user,
    ADD UNIQUE KEY uk_problem_solution_one_ac (problem_id, account_type, user_id);

UPDATE problem_solution_progress progress
LEFT JOIN problem_solution_level_ac accepted
    ON accepted.problem_id = progress.problem_id
   AND accepted.account_type = progress.account_type
   AND accepted.user_id = progress.user_id
LEFT JOIN (
    SELECT problem_id, COUNT(*) AS height
    FROM problem_solution_nodes
    GROUP BY problem_id
) levels ON levels.problem_id = progress.problem_id
SET progress.completed_level = COALESCE(accepted.level_no, 0),
    progress.viewed_level = CASE
        WHEN accepted.id IS NULL THEN progress.viewed_level
        ELSE GREATEST(progress.viewed_level, COALESCE(levels.height, 1))
    END;

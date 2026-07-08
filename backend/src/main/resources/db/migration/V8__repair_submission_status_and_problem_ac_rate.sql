INSERT INTO user_problem_status (
    user_id,
    problem_id,
    best_status,
    last_status,
    last_submission_id,
    submit_count,
    accepted_at,
    last_submitted_at
)
SELECT
    s.user_id,
    s.problem_id,
    CASE
        WHEN SUM(CASE WHEN s.status = 'AC' THEN 1 ELSE 0 END) > 0 THEN 'AC'
        ELSE SUBSTRING_INDEX(GROUP_CONCAT(s.status ORDER BY s.created_at DESC, s.id DESC), ',', 1)
    END AS best_status,
    SUBSTRING_INDEX(GROUP_CONCAT(s.status ORDER BY s.created_at DESC, s.id DESC), ',', 1) AS last_status,
    CAST(SUBSTRING_INDEX(GROUP_CONCAT(s.id ORDER BY s.created_at DESC, s.id DESC), ',', 1) AS UNSIGNED) AS last_submission_id,
    COUNT(*) AS submit_count,
    MIN(CASE WHEN s.status = 'AC' THEN s.created_at ELSE NULL END) AS accepted_at,
    MAX(s.created_at) AS last_submitted_at
FROM submissions s
GROUP BY s.user_id, s.problem_id
ON DUPLICATE KEY UPDATE
    best_status = VALUES(best_status),
    last_status = VALUES(last_status),
    last_submission_id = VALUES(last_submission_id),
    submit_count = VALUES(submit_count),
    accepted_at = VALUES(accepted_at),
    last_submitted_at = VALUES(last_submitted_at);

UPDATE problems p
SET ac_rate = COALESCE((
    SELECT ROUND(SUM(CASE WHEN s.status = 'AC' THEN 1 ELSE 0 END) * 100 / NULLIF(COUNT(*), 0))
    FROM submissions s
    WHERE s.problem_id = p.id
), 0);

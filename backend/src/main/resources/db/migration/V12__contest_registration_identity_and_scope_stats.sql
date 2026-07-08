UPDATE contest_registrations
SET identity_type = 'PERSONAL',
    identity_id = user_id
WHERE identity_type IS NULL
   OR identity_id IS NULL;

UPDATE submissions s
JOIN contest_registrations r
  ON r.contest_id = s.contest_id
 AND r.user_id = s.user_id
SET s.identity_type = r.identity_type,
    s.identity_id = r.identity_id
WHERE s.contest_id IS NOT NULL
  AND (s.identity_type IS NULL OR s.identity_id IS NULL);

DELETE FROM user_problem_status;

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
WHERE s.contest_id IS NULL
GROUP BY s.user_id, s.problem_id;

INSERT INTO user_scores (user_id, total_score, rating, ac_count, submit_count, streak)
SELECT
    u.id,
    COALESCE(a.ac_count, 0) * 100,
    200 + COALESCE(a.ac_count, 0) * 16,
    COALESCE(a.ac_count, 0),
    COALESCE(s.submit_count, 0),
    COALESCE(us.streak, 0)
FROM users u
LEFT JOIN user_scores us ON us.user_id = u.id
LEFT JOIN (
    SELECT user_id, COUNT(*) AS submit_count
    FROM submissions
    WHERE contest_id IS NULL
    GROUP BY user_id
) s ON s.user_id = u.id
LEFT JOIN (
    SELECT user_id, COUNT(DISTINCT problem_id) AS ac_count
    FROM submissions
    WHERE contest_id IS NULL
      AND status = 'AC'
    GROUP BY user_id
) a ON a.user_id = u.id
ON DUPLICATE KEY UPDATE
    total_score = VALUES(total_score),
    rating = VALUES(rating),
    ac_count = VALUES(ac_count),
    submit_count = VALUES(submit_count),
    streak = VALUES(streak);

UPDATE problems p
SET ac_rate = COALESCE((
    SELECT ROUND(SUM(CASE WHEN s.status = 'AC' THEN 1 ELSE 0 END) * 100 / NULLIF(COUNT(*), 0))
    FROM submissions s
    WHERE s.problem_id = p.id
      AND s.contest_id IS NULL
), 0);

ALTER TABLE user_scores
    MODIFY rating INT NOT NULL DEFAULT 0;

INSERT INTO user_scores (user_id, total_score, rating, ac_count, submit_count, streak)
SELECT
    u.id,
    COALESCE(a.ac_count, 0) * 100,
    0,
    COALESCE(a.ac_count, 0),
    COALESCE(s.submit_count, 0),
    0
FROM users u
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
    rating = 0,
    ac_count = VALUES(ac_count),
    submit_count = VALUES(submit_count),
    streak = user_scores.streak;

CREATE INDEX idx_user_scores_ac_ranking
    ON user_scores(ac_count DESC, submit_count ASC, user_id ASC);

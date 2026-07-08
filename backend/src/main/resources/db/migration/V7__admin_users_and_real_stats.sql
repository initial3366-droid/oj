CREATE TABLE admin_users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(80) NOT NULL UNIQUE,
    email VARCHAR(160) UNIQUE,
    password_hash VARCHAR(120) NOT NULL,
    role VARCHAR(32) NOT NULL,
    display_name VARCHAR(80) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO admin_users (username, email, password_hash, role, display_name, created_at, updated_at)
SELECT username, email, password_hash, role, display_name, created_at, updated_at
FROM users
WHERE role = 'SUPER_ADMIN';

ALTER TABLE classes DROP FOREIGN KEY fk_classes_teacher;
ALTER TABLE problems DROP FOREIGN KEY fk_problems_owner;
ALTER TABLE contests DROP FOREIGN KEY fk_contests_owner;
ALTER TABLE home_daily_problem_config DROP FOREIGN KEY fk_home_daily_problem_user;
ALTER TABLE practices DROP FOREIGN KEY fk_practices_owner;

UPDATE home_daily_problem_config
SET updated_by = NULL
WHERE updated_by IN (SELECT id FROM users WHERE role = 'SUPER_ADMIN');

DELETE FROM user_problem_status
WHERE user_id IN (SELECT id FROM users WHERE role = 'SUPER_ADMIN');

DELETE FROM submission_cases
WHERE submission_id IN (
    SELECT id FROM submissions WHERE user_id IN (SELECT id FROM users WHERE role = 'SUPER_ADMIN')
);

DELETE FROM submissions
WHERE user_id IN (SELECT id FROM users WHERE role = 'SUPER_ADMIN');

DELETE FROM sandbox_runs
WHERE user_id IN (SELECT id FROM users WHERE role = 'SUPER_ADMIN');

DELETE FROM contest_standings
WHERE user_id IN (SELECT id FROM users WHERE role = 'SUPER_ADMIN');

DELETE FROM contest_registrations
WHERE user_id IN (SELECT id FROM users WHERE role = 'SUPER_ADMIN');

DELETE FROM tab_switch_logs
WHERE user_id IN (SELECT id FROM users WHERE role = 'SUPER_ADMIN');

DELETE FROM class_members
WHERE user_id IN (SELECT id FROM users WHERE role = 'SUPER_ADMIN');

DELETE FROM club_members
WHERE user_id IN (SELECT id FROM users WHERE role = 'SUPER_ADMIN');

DELETE FROM user_scores
WHERE user_id IN (SELECT id FROM users WHERE role = 'SUPER_ADMIN');

DELETE FROM users
WHERE role = 'SUPER_ADMIN';

ALTER TABLE user_scores
    MODIFY rating INT NOT NULL DEFAULT 200;

UPDATE user_scores
SET rating = 200
WHERE rating = 1500
  AND total_score = 0
  AND ac_count = 0
  AND submit_count = 0;

INSERT INTO user_scores (user_id, total_score, rating, ac_count, submit_count, streak)
SELECT
    u.id,
    COALESCE(a.ac_count, 0) * 100,
    200 + COALESCE(a.ac_count, 0) * 16,
    COALESCE(a.ac_count, 0),
    COALESCE(s.submit_count, 0),
    0
FROM users u
LEFT JOIN (
    SELECT user_id, COUNT(*) AS submit_count
    FROM submissions
    GROUP BY user_id
) s ON s.user_id = u.id
LEFT JOIN (
    SELECT user_id, COUNT(DISTINCT problem_id) AS ac_count
    FROM submissions
    WHERE status = 'AC'
    GROUP BY user_id
) a ON a.user_id = u.id
ON DUPLICATE KEY UPDATE
    total_score = VALUES(total_score),
    rating = VALUES(rating),
    ac_count = VALUES(ac_count),
    submit_count = VALUES(submit_count);

UPDATE problems p
SET ac_rate = COALESCE((
    SELECT ROUND(SUM(CASE WHEN s.status = 'AC' THEN 1 ELSE 0 END) * 100 / NULLIF(COUNT(*), 0))
    FROM submissions s
    WHERE s.problem_id = p.id
), 0);

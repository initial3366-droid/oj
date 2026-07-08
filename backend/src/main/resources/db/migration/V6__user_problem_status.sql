CREATE TABLE user_problem_status (
    user_id BIGINT NOT NULL,
    problem_id BIGINT NOT NULL,
    best_status VARCHAR(40) NOT NULL,
    last_status VARCHAR(40) NOT NULL,
    last_submission_id BIGINT,
    submit_count INT NOT NULL DEFAULT 0,
    accepted_at DATETIME,
    last_submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, problem_id),
    KEY idx_user_problem_status_problem (problem_id, best_status),
    CONSTRAINT fk_user_problem_status_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_user_problem_status_problem FOREIGN KEY (problem_id) REFERENCES problems(id),
    CONSTRAINT fk_user_problem_status_submission FOREIGN KEY (last_submission_id) REFERENCES submissions(id)
);

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
GROUP BY s.user_id, s.problem_id;

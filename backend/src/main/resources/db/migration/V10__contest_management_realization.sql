ALTER TABLE contests
    ADD COLUMN duration_minutes INT NULL AFTER description;

UPDATE contests
SET duration_minutes = TIMESTAMPDIFF(MINUTE, start_time, end_time)
WHERE duration_minutes IS NULL;

CREATE TABLE contest_audiences (
    contest_id BIGINT NOT NULL,
    audience_type VARCHAR(16) NOT NULL,
    audience_id BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (contest_id, audience_type, audience_id),
    KEY idx_contest_audiences_type_id (audience_type, audience_id),
    CONSTRAINT fk_contest_audiences_contest FOREIGN KEY (contest_id) REFERENCES contests(id)
);

INSERT IGNORE INTO contest_audiences (contest_id, audience_type, audience_id)
SELECT id, audience, COALESCE(audience_id, 0)
FROM contests;

CREATE TABLE contest_problem_case_scores (
    contest_id BIGINT NOT NULL,
    problem_id BIGINT NOT NULL,
    case_no INT NOT NULL,
    score INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (contest_id, problem_id, case_no),
    CONSTRAINT fk_contest_case_scores_contest FOREIGN KEY (contest_id) REFERENCES contests(id),
    CONSTRAINT fk_contest_case_scores_problem FOREIGN KEY (problem_id) REFERENCES problems(id)
);

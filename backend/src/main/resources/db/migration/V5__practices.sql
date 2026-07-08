CREATE TABLE practices (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    owner_id BIGINT NOT NULL,
    audience VARCHAR(16) NOT NULL DEFAULT 'ALL',
    audience_id BIGINT,
    password_hash VARCHAR(120),
    published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_practices_owner FOREIGN KEY (owner_id) REFERENCES users(id),
    KEY idx_practices_audience (audience, audience_id),
    KEY idx_practices_owner (owner_id)
);

CREATE TABLE practice_problems (
    practice_id BIGINT NOT NULL,
    problem_id BIGINT NOT NULL,
    display_order INT NOT NULL,
    score INT NOT NULL DEFAULT 100,
    PRIMARY KEY (practice_id, problem_id),
    CONSTRAINT fk_practice_problems_practice FOREIGN KEY (practice_id) REFERENCES practices(id),
    CONSTRAINT fk_practice_problems_problem FOREIGN KEY (problem_id) REFERENCES problems(id)
);

ALTER TABLE submissions
    ADD COLUMN practice_id BIGINT NULL AFTER contest_id;

ALTER TABLE submissions
    ADD CONSTRAINT fk_submissions_practice FOREIGN KEY (practice_id) REFERENCES practices(id),
    ADD KEY idx_submissions_practice_user (practice_id, user_id);

INSERT INTO practices (title, description, owner_id, audience, audience_id, password_hash, published)
SELECT '入门练习', '后台发布的默认练习', u.id, 'ALL', NULL, NULL, TRUE
FROM users u
WHERE u.username = 'teacher'
  AND NOT EXISTS (SELECT 1 FROM practices WHERE title = '入门练习');

INSERT IGNORE INTO practice_problems (practice_id, problem_id, display_order, score)
SELECT pr.id, p.id, 1, 100
FROM practices pr
JOIN problems p ON p.title = 'A+B Problem'
WHERE pr.title = '入门练习';

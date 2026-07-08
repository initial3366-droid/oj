CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(80) NOT NULL UNIQUE,
    student_no VARCHAR(80) UNIQUE,
    email VARCHAR(160) UNIQUE,
    password_hash VARCHAR(120) NOT NULL,
    role VARCHAR(32) NOT NULL,
    display_name VARCHAR(80) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE classes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    teacher_id BIGINT NOT NULL,
    invite_code VARCHAR(80) UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_classes_teacher FOREIGN KEY (teacher_id) REFERENCES users(id)
);

CREATE TABLE class_members (
    class_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (class_id, user_id),
    CONSTRAINT fk_class_members_class FOREIGN KEY (class_id) REFERENCES classes(id),
    CONSTRAINT fk_class_members_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE clubs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE club_members (
    club_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role VARCHAR(32) NOT NULL,
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (club_id, user_id),
    CONSTRAINT fk_club_members_club FOREIGN KEY (club_id) REFERENCES clubs(id),
    CONSTRAINT fk_club_members_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE tags (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(80) NOT NULL UNIQUE,
    color VARCHAR(32),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE problems (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    statement LONGTEXT NOT NULL,
    input_format TEXT,
    output_format TEXT,
    sample_cases JSON,
    time_limit INT NOT NULL,
    memory_limit INT NOT NULL,
    difficulty TINYINT NOT NULL,
    tags JSON,
    owner_id BIGINT NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    domjudge_problem_id VARCHAR(50),
    ac_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_problems_owner FOREIGN KEY (owner_id) REFERENCES users(id),
    FULLTEXT KEY ft_problems_title_statement (title, statement)
);

CREATE TABLE problem_tags (
    problem_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    PRIMARY KEY (problem_id, tag_id),
    CONSTRAINT fk_problem_tags_problem FOREIGN KEY (problem_id) REFERENCES problems(id),
    CONSTRAINT fk_problem_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id)
);

CREATE TABLE contests (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    type VARCHAR(16) NOT NULL,
    owner_id BIGINT NOT NULL,
    audience VARCHAR(16) NOT NULL,
    audience_id BIGINT,
    frozen BOOLEAN NOT NULL DEFAULT FALSE,
    allow_fullscreen BOOLEAN NOT NULL DEFAULT FALSE,
    anti_cheat_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    max_switches INT NOT NULL DEFAULT 3,
    registration_type VARCHAR(32) NOT NULL DEFAULT 'PUBLIC',
    status VARCHAR(16) NOT NULL DEFAULT 'NOT_STARTED',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_contests_owner FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE contest_problems (
    contest_id BIGINT NOT NULL,
    problem_id BIGINT NOT NULL,
    label VARCHAR(8) NOT NULL,
    score INT,
    display_order INT NOT NULL,
    PRIMARY KEY (contest_id, problem_id),
    CONSTRAINT fk_contest_problems_contest FOREIGN KEY (contest_id) REFERENCES contests(id),
    CONSTRAINT fk_contest_problems_problem FOREIGN KEY (problem_id) REFERENCES problems(id)
);

CREATE TABLE contest_registrations (
    contest_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    identity_type VARCHAR(16) NOT NULL,
    identity_id BIGINT NOT NULL,
    registered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (contest_id, user_id),
    CONSTRAINT fk_contest_registrations_contest FOREIGN KEY (contest_id) REFERENCES contests(id),
    CONSTRAINT fk_contest_registrations_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE submissions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    problem_id BIGINT NOT NULL,
    contest_id BIGINT,
    code MEDIUMTEXT NOT NULL,
    language VARCHAR(40) NOT NULL,
    status VARCHAR(40) NOT NULL,
    time_used INT,
    memory_used INT,
    identity_type VARCHAR(16),
    identity_id BIGINT,
    domjudge_submission_id VARCHAR(80),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_submissions_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_submissions_problem FOREIGN KEY (problem_id) REFERENCES problems(id),
    CONSTRAINT fk_submissions_contest FOREIGN KEY (contest_id) REFERENCES contests(id),
    KEY idx_submissions_user_problem_status (user_id, problem_id, status),
    KEY idx_submissions_contest_user (contest_id, user_id),
    KEY idx_submissions_domjudge_submission_id (domjudge_submission_id)
);

CREATE TABLE submission_cases (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    submission_id BIGINT NOT NULL,
    case_no INT NOT NULL,
    status VARCHAR(40) NOT NULL,
    time_ms INT,
    memory_kb INT,
    CONSTRAINT fk_submission_cases_submission FOREIGN KEY (submission_id) REFERENCES submissions(id)
);

CREATE TABLE sandbox_runs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    code MEDIUMTEXT NOT NULL,
    language VARCHAR(40) NOT NULL,
    input TEXT,
    output TEXT,
    status VARCHAR(40) NOT NULL,
    run_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sandbox_runs_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE contest_standings (
    contest_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    solved INT NOT NULL DEFAULT 0,
    penalty INT NOT NULL DEFAULT 0,
    last_ac_time DATETIME,
    score INT NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (contest_id, user_id),
    KEY idx_contest_standings_rank (contest_id, solved DESC, penalty ASC),
    CONSTRAINT fk_contest_standings_contest FOREIGN KEY (contest_id) REFERENCES contests(id),
    CONSTRAINT fk_contest_standings_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE user_scores (
    user_id BIGINT PRIMARY KEY,
    total_score INT NOT NULL DEFAULT 0,
    rating INT NOT NULL DEFAULT 1500,
    ac_count INT NOT NULL DEFAULT 0,
    submit_count INT NOT NULL DEFAULT 0,
    streak INT NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_scores_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE tab_switch_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    contest_id BIGINT NOT NULL,
    switch_count INT NOT NULL,
    log_detail JSON,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tab_switch_logs_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_tab_switch_logs_contest FOREIGN KEY (contest_id) REFERENCES contests(id)
);

CREATE TABLE home_daily_problem_config (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    mode VARCHAR(16) NOT NULL,
    problem_id BIGINT,
    updated_by BIGINT,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_home_daily_problem_problem FOREIGN KEY (problem_id) REFERENCES problems(id),
    CONSTRAINT fk_home_daily_problem_user FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE home_carousel_slides (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    subtitle VARCHAR(500) NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    cta VARCHAR(80) NOT NULL,
    target_url VARCHAR(200) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

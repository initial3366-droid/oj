CREATE TABLE problem_solution_nodes (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    problem_id BIGINT NOT NULL,
    parent_id BIGINT NULL,
    level_no INT NOT NULL,
    content LONGTEXT NOT NULL,
    source VARCHAR(16) NOT NULL DEFAULT 'MANUAL',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_problem_solution_level (problem_id, level_no),
    INDEX idx_problem_solution_parent (parent_id),
    CONSTRAINT fk_problem_solution_problem FOREIGN KEY (problem_id)
        REFERENCES problems(id) ON DELETE CASCADE,
    CONSTRAINT fk_problem_solution_parent FOREIGN KEY (parent_id)
        REFERENCES problem_solution_nodes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE problem_solution_progress (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    problem_id BIGINT NOT NULL,
    account_type VARCHAR(16) NOT NULL,
    user_id BIGINT NOT NULL,
    completed_level INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_problem_solution_progress_user (problem_id, account_type, user_id),
    INDEX idx_problem_solution_progress_level (problem_id, completed_level),
    CONSTRAINT fk_problem_solution_progress_problem FOREIGN KEY (problem_id)
        REFERENCES problems(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

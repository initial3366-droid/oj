CREATE TABLE user_agent_chat_history (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    request_id VARCHAR(36) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL,
    message LONGTEXT NOT NULL,
    reply LONGTEXT NULL,
    model VARCHAR(128) NULL,
    problem_id BIGINT NULL,
    contest_id BIGINT NULL,
    submission_id BIGINT NULL,
    language VARCHAR(32) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    created_at BIGINT NOT NULL,
    completed_at BIGINT NULL,
    INDEX idx_user_agent_chat_user_created (user_id, created_at, id),
    CONSTRAINT fk_user_agent_chat_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

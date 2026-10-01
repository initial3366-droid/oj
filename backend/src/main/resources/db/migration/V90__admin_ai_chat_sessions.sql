CREATE TABLE admin_ai_chat_sessions (
    id VARCHAR(80) NOT NULL PRIMARY KEY,
    owner_admin_id BIGINT NOT NULL,
    title VARCHAR(128) NOT NULL,
    messages LONGTEXT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    INDEX idx_admin_ai_chat_owner_updated (owner_admin_id, updated_at),
    CONSTRAINT fk_admin_ai_chat_owner FOREIGN KEY (owner_admin_id)
        REFERENCES admin_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

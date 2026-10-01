CREATE TABLE admin_ai_chat_images (
    id VARCHAR(80) NOT NULL PRIMARY KEY,
    owner_admin_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(32) NOT NULL,
    size_bytes BIGINT NOT NULL,
    width INT NOT NULL,
    height INT NOT NULL,
    data LONGBLOB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_admin_ai_chat_images_owner (owner_admin_id, created_at),
    CONSTRAINT fk_admin_ai_chat_images_owner FOREIGN KEY (owner_admin_id)
        REFERENCES admin_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

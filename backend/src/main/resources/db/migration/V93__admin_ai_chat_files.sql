CREATE TABLE admin_ai_chat_files (
    id VARCHAR(80) NOT NULL PRIMARY KEY,
    owner_admin_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL,
    entry_count INT NOT NULL,
    data LONGBLOB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_admin_ai_chat_files_owner (owner_admin_id, created_at),
    CONSTRAINT fk_admin_ai_chat_files_owner FOREIGN KEY (owner_admin_id)
        REFERENCES admin_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admin_ai_chat_imports (
    id VARCHAR(80) NOT NULL PRIMARY KEY,
    owner_admin_id BIGINT NOT NULL,
    source_key CHAR(64) NOT NULL,
    plan_json LONGTEXT NOT NULL,
    result_json LONGTEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_admin_ai_chat_import_source (owner_admin_id, source_key),
    CONSTRAINT fk_admin_ai_chat_imports_owner FOREIGN KEY (owner_admin_id)
        REFERENCES admin_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE admin_ai_chat_sessions
    ADD COLUMN title_source VARCHAR(16) NOT NULL DEFAULT 'legacy' AFTER title,
    ADD COLUMN title_revision BIGINT NOT NULL DEFAULT 0 AFTER title_source;

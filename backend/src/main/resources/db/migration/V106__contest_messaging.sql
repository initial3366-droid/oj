CREATE TABLE contest_messages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    contest_id BIGINT NOT NULL,
    participant_id BIGINT NULL COMMENT '私聊所属选手；广播为空',
    kind VARCHAR(16) NOT NULL COMMENT 'QUESTION, REPLY, BROADCAST',
    author_id BIGINT NOT NULL,
    author_account_type VARCHAR(16) NOT NULL,
    author_name VARCHAR(80) NOT NULL,
    content VARCHAR(2000) NOT NULL,
    request_id VARCHAR(36) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_contest_message_request (contest_id, author_account_type, author_id, request_id),
    KEY idx_contest_messages_participant (contest_id, participant_id, id),
    CONSTRAINT fk_contest_messages_contest FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE,
    CONSTRAINT fk_contest_messages_participant FOREIGN KEY (participant_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE contest_message_reads (
    contest_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    last_read_id BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (contest_id, user_id),
    CONSTRAINT fk_contest_message_reads_contest FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE,
    CONSTRAINT fk_contest_message_reads_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

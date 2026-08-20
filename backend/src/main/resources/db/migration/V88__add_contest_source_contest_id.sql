ALTER TABLE contests
    ADD COLUMN source_contest_id BIGINT NULL;

CREATE INDEX idx_contests_source_contest_id
    ON contests (source_contest_id);

ALTER TABLE contests
    ADD COLUMN scoreboard_enabled TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN results_published TINYINT(1) NOT NULL DEFAULT 0;

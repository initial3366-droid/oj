-- Historical publications retain their existing access until a teacher sets a schedule.
ALTER TABLE practice_publications
    ADD COLUMN start_time DATETIME NULL,
    ADD COLUMN end_time DATETIME NULL;

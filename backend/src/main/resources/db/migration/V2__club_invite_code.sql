ALTER TABLE clubs
    ADD COLUMN invite_code VARCHAR(80) UNIQUE AFTER description;

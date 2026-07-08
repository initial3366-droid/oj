-- V27: remove the unused carousel extra text column from the latest schema.

SET @carousel_extra_text_column := CONCAT('sub', 'title');

SET @drop_carousel_extra_text_sql := (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'home_carousel_slides'
              AND COLUMN_NAME = @carousel_extra_text_column
        ),
        CONCAT('ALTER TABLE home_carousel_slides DROP COLUMN ', @carousel_extra_text_column),
        'SELECT 1'
    )
);

PREPARE stmt FROM @drop_carousel_extra_text_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

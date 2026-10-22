CREATE TABLE course_classes (
    course_id BIGINT NOT NULL,
    class_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (course_id, class_id),
    KEY idx_course_classes_class (class_id, course_id),
    CONSTRAINT fk_course_classes_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT fk_course_classes_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Preserve all single-class courses and their publication/submission IDs.
INSERT INTO course_classes (course_id, class_id)
SELECT id, class_id FROM courses WHERE class_id IS NOT NULL;
-- courses.class_id remains a compatibility summary only; course_classes is authoritative.

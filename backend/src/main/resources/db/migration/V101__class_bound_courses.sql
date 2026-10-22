-- Keep an audit of legacy memberships before enforcing one class per student.
CREATE TABLE course_migration_membership_audit AS
SELECT cm.*, u.class_id AS previous_primary_class_id
FROM class_members cm JOIN users u ON u.id = cm.user_id
WHERE cm.user_id IN (SELECT user_id FROM class_members GROUP BY user_id HAVING COUNT(*) > 1);

CREATE TEMPORARY TABLE course_member_primary AS
SELECT cm.user_id, COALESCE(MAX(CASE WHEN cm.class_id = u.class_id THEN cm.class_id END), MIN(cm.class_id)) AS class_id
FROM class_members cm JOIN users u ON u.id = cm.user_id GROUP BY cm.user_id;
DELETE cm FROM class_members cm JOIN course_member_primary chosen ON chosen.user_id = cm.user_id
WHERE cm.class_id <> chosen.class_id;
UPDATE users u JOIN course_member_primary chosen ON chosen.user_id = u.id SET u.class_id = chosen.class_id;
DROP TEMPORARY TABLE course_member_primary;
ALTER TABLE class_members ADD UNIQUE KEY uk_class_members_one_class (user_id);

CREATE TABLE courses (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    term VARCHAR(100),
    owner_account_type VARCHAR(16) NOT NULL,
    owner_id BIGINT NOT NULL,
    class_id BIGINT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_courses_owner (owner_account_type, owner_id),
    KEY idx_courses_class_status (class_id, status),
    CONSTRAINT fk_courses_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
ALTER TABLE practice_publications
    ADD COLUMN course_id BIGINT NULL,
    ADD COLUMN display_order INT NOT NULL DEFAULT 1,
    ADD KEY idx_publications_course_order (course_id, status, display_order),
    ADD CONSTRAINT fk_publications_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT;

-- Single-class historical assignments can be grouped without changing publication/submission IDs.
INSERT INTO courses (title, description, owner_account_type, owner_id, class_id, status)
SELECT CONCAT(c.name, ' · 历史练习'), '原班级题单自动迁入，保留发布实例和提交记录。',
       p.publisher_account_type, p.publisher_id, g.class_id, 'ACTIVE'
FROM practice_publications p
JOIN (SELECT publication_id, MIN(class_id) class_id FROM practice_publication_classes
      GROUP BY publication_id HAVING COUNT(*) = 1) g ON g.publication_id = p.id
JOIN classes c ON c.id = g.class_id
WHERE p.student_access_mode = 'SELECTED_CLASSES'
GROUP BY c.name, p.publisher_account_type, p.publisher_id, g.class_id;
UPDATE practice_publications p
JOIN (SELECT publication_id, MIN(class_id) class_id FROM practice_publication_classes
      GROUP BY publication_id HAVING COUNT(*) = 1) g ON g.publication_id = p.id
JOIN courses c ON c.class_id = g.class_id AND c.owner_account_type = p.publisher_account_type
    AND c.owner_id = p.publisher_id
SET p.course_id = c.id, p.display_order = p.id
WHERE p.student_access_mode = 'SELECTED_CLASSES';
-- Public and multi-class legacy publications retain their IDs and original historical access.

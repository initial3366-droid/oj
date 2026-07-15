SET @schema_name = DATABASE();

CREATE TABLE majors (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(120) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_majors_code (code),
    UNIQUE KEY uk_majors_name (name),
    KEY idx_majors_status_name (status, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO majors (code, name, status)
VALUES ('__UNASSIGNED__', '待分配专业', 'DISABLED');
SET @unassigned_major_id = LAST_INSERT_ID();

CREATE TABLE teachers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(80) NOT NULL,
    teacher_no VARCHAR(80),
    email VARCHAR(160),
    password_hash VARCHAR(120) NOT NULL,
    display_name VARCHAR(80) NOT NULL,
    avatar_url VARCHAR(512),
    major_id BIGINT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_teachers_username (username),
    UNIQUE KEY uk_teachers_teacher_no (teacher_no),
    UNIQUE KEY uk_teachers_email (email),
    KEY idx_teachers_major_status (major_id, status),
    CONSTRAINT fk_teachers_major FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO teachers (
    id, username, teacher_no, email, password_hash, display_name, avatar_url, major_id, status, created_at, updated_at
)
SELECT
    id, username, student_no, email, password_hash, display_name, avatar_url, @unassigned_major_id, 'ACTIVE', created_at, updated_at
FROM users
WHERE role = 'TEACHER';

ALTER TABLE classes DROP FOREIGN KEY fk_classes_teacher_user;
ALTER TABLE classes
    ADD CONSTRAINT fk_classes_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT;

ALTER TABLE class_join_applications DROP FOREIGN KEY fk_class_join_applications_handler;
ALTER TABLE class_join_applications
    ADD COLUMN handled_by_account_type VARCHAR(16) NULL AFTER handled_by;

UPDATE class_join_applications a
JOIN teachers t ON t.id = a.handled_by
SET a.handled_by_account_type = 'TEACHER'
WHERE a.handled_by IS NOT NULL;

UPDATE class_join_applications a
JOIN admin_users au ON au.id = a.handled_by
SET a.handled_by_account_type = 'ADMIN'
WHERE a.handled_by IS NOT NULL
  AND a.handled_by_account_type IS NULL;

ALTER TABLE problem_folders
    ADD COLUMN owner_account_type VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN' AFTER owner_id,
    ADD COLUMN access_scope VARCHAR(16) NOT NULL DEFAULT 'PRIVATE' AFTER owner_account_type,
    ADD COLUMN major_id BIGINT NULL AFTER access_scope,
    ADD KEY idx_problem_folders_scope_major (access_scope, major_id),
    ADD KEY idx_problem_folders_owner_identity (owner_account_type, owner_id),
    ADD CONSTRAINT fk_problem_folders_major FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE RESTRICT;

UPDATE problem_folders pf
LEFT JOIN teachers t ON t.id = pf.owner_id
LEFT JOIN admin_users au ON au.id = pf.owner_id
SET pf.owner_account_type = CASE
    WHEN pf.owner_id IS NULL THEN 'SYSTEM'
    WHEN t.id IS NOT NULL AND au.id IS NULL THEN 'TEACHER'
    WHEN t.id IS NULL AND au.id IS NOT NULL THEN 'ADMIN'
    WHEN t.id IS NOT NULL AND EXISTS (
        SELECT 1 FROM problems p
        WHERE p.folder_id = pf.id
          AND p.owner_id = pf.owner_id
          AND p.owner_account_type = 'USER'
    ) THEN 'TEACHER'
    ELSE 'UNKNOWN'
END;

ALTER TABLE problems
    ADD COLUMN access_scope VARCHAR(16) NOT NULL DEFAULT 'PRIVATE' AFTER owner_account_type,
    ADD COLUMN major_id BIGINT NULL AFTER access_scope,
    ADD COLUMN student_publish_status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' AFTER is_public,
    ADD COLUMN published_by_account_type VARCHAR(16) NULL AFTER student_publish_status,
    ADD COLUMN published_by_id BIGINT NULL AFTER published_by_account_type,
    ADD COLUMN published_at DATETIME NULL AFTER published_by_id,
    ADD KEY idx_problems_scope_major (access_scope, major_id),
    ADD KEY idx_problems_student_publish (student_publish_status, is_deleted),
    ADD CONSTRAINT fk_problems_major FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE RESTRICT;

UPDATE problems p
JOIN teachers t ON t.id = p.owner_id
SET p.owner_account_type = 'TEACHER'
WHERE p.owner_account_type = 'USER';

UPDATE problems p
LEFT JOIN teachers t ON t.id = p.owner_id AND p.owner_account_type = 'TEACHER'
SET p.major_id = t.major_id,
    p.access_scope = CASE WHEN p.is_public = TRUE THEN 'ALL' ELSE 'PRIVATE' END,
    p.student_publish_status = CASE WHEN p.is_public = TRUE THEN 'PUBLISHED' ELSE 'DRAFT' END,
    p.published_by_account_type = CASE WHEN p.is_public = TRUE THEN p.owner_account_type ELSE NULL END,
    p.published_by_id = CASE WHEN p.is_public = TRUE THEN p.owner_id ELSE NULL END,
    p.published_at = CASE WHEN p.is_public = TRUE THEN p.updated_at ELSE NULL END;

UPDATE problem_folders pf
JOIN teachers t ON t.id = pf.owner_id AND pf.owner_account_type = 'TEACHER'
SET pf.major_id = t.major_id;

ALTER TABLE practices
    ADD COLUMN owner_account_type VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN' AFTER owner_id,
    ADD COLUMN access_scope VARCHAR(16) NOT NULL DEFAULT 'PRIVATE' AFTER owner_account_type,
    ADD COLUMN major_id BIGINT NULL AFTER access_scope,
    ADD KEY idx_practices_owner_identity (owner_account_type, owner_id),
    ADD KEY idx_practices_scope_major (access_scope, major_id),
    ADD CONSTRAINT fk_practices_major FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE RESTRICT;

UPDATE practices p
LEFT JOIN teachers t ON t.id = p.owner_id
LEFT JOIN admin_users au ON au.id = p.owner_id
SET p.owner_account_type = CASE
    WHEN t.id IS NOT NULL AND au.id IS NULL THEN 'TEACHER'
    WHEN t.id IS NULL AND au.id IS NOT NULL THEN 'ADMIN'
    ELSE 'UNKNOWN'
END;

UPDATE practices p
JOIN teachers t ON t.id = p.owner_id AND p.owner_account_type = 'TEACHER'
SET p.major_id = t.major_id;

UPDATE contests c
JOIN teachers t ON t.id = c.owner_id
SET c.owner_account_type = 'TEACHER'
WHERE c.owner_account_type = 'USER';

CREATE TABLE practice_publications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    source_practice_id BIGINT NOT NULL,
    publisher_account_type VARCHAR(16) NOT NULL,
    publisher_id BIGINT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    student_access_mode VARCHAR(32) NOT NULL DEFAULT 'ALL',
    password_hash VARCHAR(120),
    published_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_practice_publications_source (source_practice_id),
    KEY idx_practice_publications_publisher (publisher_account_type, publisher_id),
    KEY idx_practice_publications_status (status, published_at),
    CONSTRAINT fk_practice_publications_source FOREIGN KEY (source_practice_id) REFERENCES practices(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE practice_publication_classes (
    publication_id BIGINT NOT NULL,
    class_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (publication_id, class_id),
    KEY idx_practice_publication_classes_class (class_id, publication_id),
    CONSTRAINT fk_practice_publication_classes_publication FOREIGN KEY (publication_id)
        REFERENCES practice_publications(id) ON DELETE CASCADE,
    CONSTRAINT fk_practice_publication_classes_class FOREIGN KEY (class_id)
        REFERENCES classes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE practice_publication_problems (
    publication_id BIGINT NOT NULL,
    problem_id BIGINT NOT NULL,
    display_order INT NOT NULL,
    score INT NOT NULL DEFAULT 100,
    visibility VARCHAR(16) NOT NULL DEFAULT 'VISIBLE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (publication_id, problem_id),
    KEY idx_practice_publication_problems_problem (problem_id, publication_id),
    CONSTRAINT fk_practice_publication_problems_publication FOREIGN KEY (publication_id)
        REFERENCES practice_publications(id) ON DELETE CASCADE,
    CONSTRAINT fk_practice_publication_problems_problem FOREIGN KEY (problem_id)
        REFERENCES problems(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO practice_publications (
    id, source_practice_id, publisher_account_type, publisher_id, title, description,
    status, student_access_mode, password_hash, published_at, created_at, updated_at
)
SELECT
    p.id, p.id, p.owner_account_type, p.owner_id, p.title, p.description,
    'PUBLISHED', CASE WHEN p.audience = 'CLASS' THEN 'SELECTED_CLASSES' ELSE 'ALL' END,
    p.password_hash, p.updated_at, p.created_at, p.updated_at
FROM practices p
WHERE p.published = TRUE
  AND p.is_deleted = FALSE;

INSERT INTO practice_publication_classes (publication_id, class_id, created_at)
SELECT pp.id, p.audience_id, p.created_at
FROM practice_publications pp
JOIN practices p ON p.id = pp.source_practice_id
JOIN classes c ON c.id = p.audience_id
WHERE p.audience = 'CLASS'
  AND p.audience_id IS NOT NULL;

INSERT INTO practice_publication_problems (
    publication_id, problem_id, display_order, score, visibility, created_at
)
SELECT pp.id, ppr.problem_id, ppr.display_order, ppr.score, 'VISIBLE', pp.created_at
FROM practice_publications pp
JOIN practice_problems ppr ON ppr.practice_id = pp.source_practice_id;

ALTER TABLE submissions
    ADD COLUMN practice_publication_id BIGINT NULL AFTER practice_id,
    ADD KEY idx_submissions_practice_publication_user (practice_publication_id, user_id),
    ADD CONSTRAINT fk_submissions_practice_publication FOREIGN KEY (practice_publication_id)
        REFERENCES practice_publications(id) ON DELETE RESTRICT;

UPDATE submissions s
JOIN practice_publications pp ON pp.source_practice_id = s.practice_id
SET s.practice_publication_id = pp.id
WHERE s.practice_id IS NOT NULL;

-- Teachers no longer participate in student-only ranking and submission tables.
DELETE acrp FROM contest_acm_rank_problems acrp
JOIN contest_participants cp ON cp.id = acrp.participant_id
JOIN teachers t ON t.id = cp.user_id;
DELETE acrc FROM contest_acm_rank_cache acrc
JOIN contest_participants cp ON cp.id = acrc.participant_id
JOIN teachers t ON t.id = cp.user_id;
DELETE oirp FROM contest_oi_rank_problems oirp
JOIN contest_participants cp ON cp.id = oirp.participant_id
JOIN teachers t ON t.id = cp.user_id;
DELETE oirc FROM contest_oi_rank_cache oirc
JOIN contest_participants cp ON cp.id = oirc.participant_id
JOIN teachers t ON t.id = cp.user_id;
DELETE cp FROM contest_participants cp JOIN teachers t ON t.id = cp.user_id;
DELETE scr FROM submission_case_results scr
JOIN submissions s ON s.id = scr.submission_id
JOIN teachers t ON t.id = s.user_id;
DELETE ups FROM user_problem_status ups JOIN teachers t ON t.id = ups.user_id;
DELETE s FROM submissions s JOIN teachers t ON t.id = s.user_id;
DELETE sr FROM sandbox_runs sr JOIN teachers t ON t.id = sr.user_id;
DELETE cr FROM contest_registrations cr JOIN teachers t ON t.id = cr.user_id;
DELETE tsl FROM tab_switch_logs tsl JOIN teachers t ON t.id = tsl.user_id;
DELETE cm FROM class_members cm JOIN teachers t ON t.id = cm.user_id;
DELETE cja FROM class_join_applications cja JOIN teachers t ON t.id = cja.user_id;
DELETE us FROM user_scores us JOIN teachers t ON t.id = us.user_id;
DELETE u FROM users u JOIN teachers t ON t.id = u.id WHERE u.role = 'TEACHER';

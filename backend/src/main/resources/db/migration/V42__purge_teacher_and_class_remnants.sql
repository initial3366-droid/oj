SET @schema_name = DATABASE();

CREATE TEMPORARY TABLE tmp_removed_teacher_users (
    id BIGINT PRIMARY KEY
);

INSERT IGNORE INTO tmp_removed_teacher_users (id)
SELECT id
FROM users
WHERE role = 'TEACHER'
   OR username = 'teacher'
   OR student_no LIKE 'T%'
   OR email LIKE 'teacher@%'
   OR display_name LIKE '%教师%';

SET @fallback_admin_id := (
    SELECT id
    FROM admin_users
    WHERE role = 'SUPER_ADMIN'
    ORDER BY id
    LIMIT 1
);

UPDATE problems p
LEFT JOIN users u ON u.id = p.owner_id
SET p.owner_id = @fallback_admin_id
WHERE @fallback_admin_id IS NOT NULL
  AND u.id IS NULL;

UPDATE practices p
LEFT JOIN users u ON u.id = p.owner_id
SET p.owner_id = @fallback_admin_id
WHERE @fallback_admin_id IS NOT NULL
  AND u.id IS NULL;

UPDATE contests c
LEFT JOIN users u ON u.id = c.owner_id
LEFT JOIN admin_users au ON au.id = c.owner_id
SET c.owner_id = @fallback_admin_id,
    c.owner_account_type = 'ADMIN'
WHERE @fallback_admin_id IS NOT NULL
  AND (
      (c.owner_account_type = 'USER' AND u.id IS NULL)
      OR (c.owner_account_type = 'ADMIN' AND au.id IS NULL)
  );

UPDATE clubs
SET owner_id = NULL
WHERE owner_id IN (SELECT id FROM tmp_removed_teacher_users);

UPDATE club_join_applications
SET handled_by = NULL
WHERE handled_by IN (SELECT id FROM tmp_removed_teacher_users);

UPDATE problems
SET owner_id = @fallback_admin_id
WHERE @fallback_admin_id IS NOT NULL
  AND owner_id IN (SELECT id FROM tmp_removed_teacher_users);

UPDATE contests
SET owner_id = @fallback_admin_id,
    owner_account_type = 'ADMIN'
WHERE owner_account_type = 'USER'
  AND @fallback_admin_id IS NOT NULL
  AND owner_id IN (SELECT id FROM tmp_removed_teacher_users);

UPDATE practices
SET owner_id = @fallback_admin_id
WHERE @fallback_admin_id IS NOT NULL
  AND owner_id IN (SELECT id FROM tmp_removed_teacher_users);

DELETE acrp
FROM contest_acm_rank_problems acrp
JOIN contest_participants cp ON cp.id = acrp.participant_id
WHERE cp.user_id IN (SELECT id FROM tmp_removed_teacher_users);

DELETE acrc
FROM contest_acm_rank_cache acrc
JOIN contest_participants cp ON cp.id = acrc.participant_id
WHERE cp.user_id IN (SELECT id FROM tmp_removed_teacher_users);

DELETE oirp
FROM contest_oi_rank_problems oirp
JOIN contest_participants cp ON cp.id = oirp.participant_id
WHERE cp.user_id IN (SELECT id FROM tmp_removed_teacher_users);

DELETE oirc
FROM contest_oi_rank_cache oirc
JOIN contest_participants cp ON cp.id = oirc.participant_id
WHERE cp.user_id IN (SELECT id FROM tmp_removed_teacher_users);

DELETE FROM contest_participants
WHERE user_id IN (SELECT id FROM tmp_removed_teacher_users);

DELETE scr
FROM submission_case_results scr
JOIN submissions s ON s.id = scr.submission_id
WHERE s.user_id IN (SELECT id FROM tmp_removed_teacher_users);

SET @table_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'submission_cases'
);
SET @sql := IF(
    @table_exists > 0,
    'DELETE sc FROM submission_cases sc JOIN submissions s ON s.id = sc.submission_id JOIN tmp_removed_teacher_users t ON t.id = s.user_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DELETE FROM user_problem_status
WHERE user_id IN (SELECT id FROM tmp_removed_teacher_users);

DELETE FROM submissions
WHERE user_id IN (SELECT id FROM tmp_removed_teacher_users);

DELETE FROM sandbox_runs
WHERE user_id IN (SELECT id FROM tmp_removed_teacher_users);

SET @table_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'contest_standings'
);
SET @sql := IF(
    @table_exists > 0,
    'DELETE cs FROM contest_standings cs JOIN tmp_removed_teacher_users t ON t.id = cs.user_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @table_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = '_deprecated_contest_standings'
);
SET @sql := IF(
    @table_exists > 0,
    'DELETE cs FROM _deprecated_contest_standings cs JOIN tmp_removed_teacher_users t ON t.id = cs.user_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DELETE FROM contest_registrations
WHERE user_id IN (SELECT id FROM tmp_removed_teacher_users);

DELETE FROM tab_switch_logs
WHERE user_id IN (SELECT id FROM tmp_removed_teacher_users);

DELETE FROM club_members
WHERE user_id IN (SELECT id FROM tmp_removed_teacher_users);

DELETE FROM club_join_applications
WHERE user_id IN (SELECT id FROM tmp_removed_teacher_users);

DELETE FROM user_scores
WHERE user_id IN (SELECT id FROM tmp_removed_teacher_users);

DELETE FROM users
WHERE id IN (SELECT id FROM tmp_removed_teacher_users);

UPDATE contests
SET audience = 'ALL', audience_id = NULL
WHERE audience = 'CLASS';

UPDATE practices
SET audience = 'ALL', audience_id = NULL
WHERE audience = 'CLASS';

DELETE FROM contest_audiences
WHERE audience_type = 'CLASS';

UPDATE contest_registrations
SET identity_type = 'PERSONAL', identity_id = user_id
WHERE identity_type = 'CLASS';

UPDATE contest_participants
SET identity_type = 'PERSONAL', identity_id = user_id
WHERE identity_type = 'CLASS';

UPDATE submissions
SET identity_type = 'PERSONAL', identity_id = user_id
WHERE identity_type = 'CLASS';

UPDATE system_settings
SET setting_value = JSON_REMOVE(setting_value, '$.className')
WHERE setting_key = 'register.fields_config'
  AND JSON_CONTAINS_PATH(setting_value, 'one', '$.className');

INSERT INTO system_settings (setting_key, setting_value, category, description)
SELECT
    'register.fields_config',
    '{"studentNo":{"enabled":true,"required":true},"email":{"enabled":true,"required":false}}',
    'register',
    '注册字段配置'
WHERE NOT EXISTS (
    SELECT 1 FROM system_settings WHERE setting_key = 'register.fields_config'
);

SET @fk_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'class_members'
      AND CONSTRAINT_NAME = 'fk_class_members_class'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(@fk_exists > 0, 'ALTER TABLE `class_members` DROP FOREIGN KEY `fk_class_members_class`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'class_members'
      AND CONSTRAINT_NAME = 'fk_class_members_user'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(@fk_exists > 0, 'ALTER TABLE `class_members` DROP FOREIGN KEY `fk_class_members_user`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'classes'
      AND CONSTRAINT_NAME = 'fk_classes_teacher'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(@fk_exists > 0, 'ALTER TABLE `classes` DROP FOREIGN KEY `fk_classes_teacher`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DROP TABLE IF EXISTS class_members;
DROP TABLE IF EXISTS classes;

DROP TEMPORARY TABLE tmp_removed_teacher_users;

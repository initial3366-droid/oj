SET @schema_name = DATABASE();

UPDATE clubs c
JOIN users u ON u.id = c.owner_id
SET c.owner_id = NULL
WHERE u.role = 'TEACHER';

UPDATE club_join_applications cja
JOIN users u ON u.id = cja.handled_by
SET cja.handled_by = NULL
WHERE u.role = 'TEACHER';

DELETE acrp
FROM contest_acm_rank_problems acrp
JOIN contest_participants cp ON cp.id = acrp.participant_id
JOIN users u ON u.id = cp.user_id
WHERE u.role = 'TEACHER';

DELETE acrc
FROM contest_acm_rank_cache acrc
JOIN contest_participants cp ON cp.id = acrc.participant_id
JOIN users u ON u.id = cp.user_id
WHERE u.role = 'TEACHER';

DELETE oirp
FROM contest_oi_rank_problems oirp
JOIN contest_participants cp ON cp.id = oirp.participant_id
JOIN users u ON u.id = cp.user_id
WHERE u.role = 'TEACHER';

DELETE oirc
FROM contest_oi_rank_cache oirc
JOIN contest_participants cp ON cp.id = oirc.participant_id
JOIN users u ON u.id = cp.user_id
WHERE u.role = 'TEACHER';

DELETE cp
FROM contest_participants cp
JOIN users u ON u.id = cp.user_id
WHERE u.role = 'TEACHER';

DELETE scr
FROM submission_case_results scr
JOIN submissions s ON s.id = scr.submission_id
JOIN users u ON u.id = s.user_id
WHERE u.role = 'TEACHER';

SET @has_submission_cases := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'submission_cases'
);
SET @sql := IF(
    @has_submission_cases > 0,
    'DELETE sc FROM submission_cases sc JOIN submissions s ON s.id = sc.submission_id JOIN users u ON u.id = s.user_id WHERE u.role = ''TEACHER''',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DELETE ups
FROM user_problem_status ups
JOIN users u ON u.id = ups.user_id
WHERE u.role = 'TEACHER';

DELETE s
FROM submissions s
JOIN users u ON u.id = s.user_id
WHERE u.role = 'TEACHER';

DELETE sr
FROM sandbox_runs sr
JOIN users u ON u.id = sr.user_id
WHERE u.role = 'TEACHER';

SET @has_contest_standings := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'contest_standings'
);
SET @sql := IF(
    @has_contest_standings > 0,
    'DELETE cs FROM contest_standings cs JOIN users u ON u.id = cs.user_id WHERE u.role = ''TEACHER''',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_deprecated_contest_standings := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = '_deprecated_contest_standings'
);
SET @sql := IF(
    @has_deprecated_contest_standings > 0,
    'DELETE cs FROM _deprecated_contest_standings cs JOIN users u ON u.id = cs.user_id WHERE u.role = ''TEACHER''',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DELETE cr
FROM contest_registrations cr
JOIN users u ON u.id = cr.user_id
WHERE u.role = 'TEACHER';

DELETE tsl
FROM tab_switch_logs tsl
JOIN users u ON u.id = tsl.user_id
WHERE u.role = 'TEACHER';

DELETE cm
FROM club_members cm
JOIN users u ON u.id = cm.user_id
WHERE u.role = 'TEACHER';

DELETE cja
FROM club_join_applications cja
JOIN users u ON u.id = cja.user_id
WHERE u.role = 'TEACHER';

DELETE us
FROM user_scores us
JOIN users u ON u.id = us.user_id
WHERE u.role = 'TEACHER';

DELETE FROM users WHERE role = 'TEACHER';

SET @has_class_members := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'class_members'
);
SET @sql := IF(@has_class_members > 0, 'DELETE FROM class_members', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_classes := (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'classes'
);
SET @sql := IF(@has_classes > 0, 'DELETE FROM classes', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

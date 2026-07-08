INSERT IGNORE INTO users (username, student_no, email, password_hash, role, display_name)
VALUES
    ('admin', NULL, 'admin@qoj.local', '$2y$12$lgK2BzmwVbP1bdQNVihl5OcKBMHZuRr3h.Y0onvtnWVvSJZT030su', 'SUPER_ADMIN', '系统管理员'),
    ('teacher', 'T2026001', 'teacher@qoj.local', '$2y$12$1Fy7pjKlMv3w8dKXC2bWOedwaG2sa0ugfT1DkMAkyxb.uvAPO8IM.', 'TEACHER', '训练教师'),
    ('student', 'S2026001', 'student@qoj.local', '$2y$12$j.hu14hbNPHCe38YG7U68eCK/jNSzxzgkg6Df1g.UCWZSdJdFNsdW', 'STUDENT', '示例学生');

INSERT IGNORE INTO user_scores (user_id, total_score, rating, ac_count, submit_count, streak)
SELECT id, 0, 1500, 0, 0, 0
FROM users
WHERE username IN ('admin', 'teacher', 'student');

INSERT IGNORE INTO classes (name, teacher_id, invite_code)
SELECT '算法训练班', id, 'class-acm'
FROM users
WHERE username = 'teacher';

INSERT IGNORE INTO class_members (class_id, user_id)
SELECT c.id, u.id
FROM classes c
JOIN users u ON u.username = 'student'
WHERE c.invite_code = 'class-acm';

INSERT IGNORE INTO clubs (name, description, invite_code)
VALUES ('ACM 校队', '校园算法训练社团', 'club-acm');

INSERT IGNORE INTO club_members (club_id, user_id, role)
SELECT c.id, u.id, 'ADMIN'
FROM clubs c
JOIN users u ON u.username = 'teacher'
WHERE c.invite_code = 'club-acm';

INSERT IGNORE INTO club_members (club_id, user_id, role)
SELECT c.id, u.id, 'MEMBER'
FROM clubs c
JOIN users u ON u.username = 'student'
WHERE c.invite_code = 'club-acm';

INSERT IGNORE INTO tags (name, color)
VALUES
    ('入门', '#10B981'),
    ('模拟', '#2563EB');

INSERT INTO problems (
    title,
    statement,
    input_format,
    output_format,
    sample_cases,
    time_limit,
    memory_limit,
    difficulty,
    tags,
    owner_id,
    is_public,
    ac_rate
)
SELECT
    'A+B Problem',
    '给定两个整数 a 和 b，输出它们的和。',
    '一行两个整数 a 和 b。',
    '输出一个整数表示答案。',
    JSON_ARRAY(JSON_OBJECT('input', '1 2', 'output', '3', 'explanation', '1 + 2 = 3')),
    1000,
    128,
    1,
    JSON_ARRAY('入门', '模拟'),
    u.id,
    TRUE,
    0
FROM users u
WHERE u.username = 'teacher'
  AND NOT EXISTS (SELECT 1 FROM problems p WHERE p.title = 'A+B Problem');

INSERT INTO contests (
    title,
    description,
    start_time,
    end_time,
    type,
    owner_id,
    audience,
    audience_id,
    frozen,
    allow_fullscreen,
    anti_cheat_enabled,
    max_switches,
    registration_type,
    status
)
SELECT
    '校园训练赛',
    '日常算法训练比赛',
    DATE_ADD(UTC_TIMESTAMP(), INTERVAL 3 DAY),
    DATE_ADD(UTC_TIMESTAMP(), INTERVAL 77 HOUR),
    'ACM',
    u.id,
    'ALL',
    NULL,
    TRUE,
    FALSE,
    TRUE,
    3,
    'PUBLIC',
    'NOT_STARTED'
FROM users u
WHERE u.username = 'teacher'
  AND NOT EXISTS (SELECT 1 FROM contests c WHERE c.title = '校园训练赛');

INSERT IGNORE INTO contest_problems (contest_id, problem_id, label, score, display_order)
SELECT c.id, p.id, 'A', 100, 1
FROM contests c
JOIN problems p ON p.title = 'A+B Problem'
WHERE c.title = '校园训练赛';

INSERT INTO home_daily_problem_config (mode, problem_id, updated_by)
SELECT 'MANUAL', p.id, u.id
FROM problems p
JOIN users u ON u.username = 'admin'
WHERE p.title = 'A+B Problem'
  AND NOT EXISTS (SELECT 1 FROM home_daily_problem_config);

INSERT INTO home_carousel_slides (title, subtitle, image_url, cta, target_url, display_order, enabled)
SELECT '题库训练', '从每日一题开始保持训练节奏', '/banners/problem-bank.svg', '进入题库', '/problems', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM home_carousel_slides WHERE title = '题库训练');

INSERT INTO home_carousel_slides (title, subtitle, image_url, cta, target_url, display_order, enabled)
SELECT '近期比赛', '报名参加校园训练赛并查看实时榜单', '/banners/contest-lab.svg', '查看比赛', '/contests', 2, TRUE
WHERE NOT EXISTS (SELECT 1 FROM home_carousel_slides WHERE title = '近期比赛');

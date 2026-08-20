-- V77: 兜底修复 classes.fk_classes_teacher 外键（V69 遗留隐患）
--
-- ============================================================
-- 隐患是怎么来的
-- ============================================================
-- V69:38-48 先从 users 里筛 role = 'TEACHER' 播种 teachers 表，
-- 紧接着把 classes.teacher_id 的外键从 users 重指向 teachers：
--     ALTER TABLE classes DROP FOREIGN KEY fk_classes_teacher_user;
--     ALTER TABLE classes ADD CONSTRAINT fk_classes_teacher
--         FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT;
-- 但 V44:98 播种 classes 时用的条件是
--     WHERE c.owner_id IS NOT NULL AND u.role IN ('TEACHER','CLUB_ADMIN','STUDENT')
-- 也就是社团 owner 只要是 CLUB_ADMIN 或 STUDENT 也会成为 classes.teacher_id；
-- 而 V42:169 在 V44 之前就已经硬删了全部 TEACHER 用户。
-- 于是社团派生出来的班级，其 teacher_id 按构造必然不在 V69 播种出的 teachers 里，
-- ADD CONSTRAINT 立刻抛 errno 1452，V69 从中间断掉。
-- V69 全程零守卫，加上 MySQL DDL 不进事务，断掉时 majors/teachers 已建、
-- 旧外键 fk_classes_teacher_user 已被删除，重跑会在第 3 行 CREATE TABLE majors
-- 直接因表已存在再次失败。
--
-- ============================================================
-- 本迁移能救什么、不能救什么
-- ============================================================
-- 不能救：如果某套库上 V69 真的执行失败了，flyway_schema_history 里会留下一条
-- success = 0 的记录，Flyway 在下一次 migrate 时会直接抛
-- "Detected failed migration to version 69" 并拒绝执行任何后续迁移，
-- 本文件根本不会被跑到。那种库只能先人工介入（见本文件末尾的运维说明）。
--
-- 能救：人工把 V69 补完并在 flyway_schema_history 里标成成功、但漏掉或做错了
-- fk_classes_teacher 这一步的库。这类库表面上迁移链是通的，实际上班级与教师之间
-- 完全没有引用约束，teacher_id 可以随便悬空。本迁移把这种状态收敛回正确形态。
--
-- 对 V69 正常成功的库（外键已在位），本文件全程是空操作。

SET @schema_name = DATABASE();

-- ============================================================
-- 判定是否需要修复
-- ============================================================
-- 四个条件同时成立才动手：classes / teachers / majors 三张表都在，
-- 且 classes 上确实没有 fk_classes_teacher 这条外键。
SET @has_classes = (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'classes'
);
SET @has_teachers = (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'teachers'
);
SET @has_majors = (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'majors'
);
SET @has_fk = (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'classes'
      AND CONSTRAINT_NAME = 'fk_classes_teacher'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @needs_repair = IF(@has_classes > 0 AND @has_teachers > 0 AND @has_majors > 0 AND @has_fk = 0, 1, 0);

-- ============================================================
-- 第一步：确保占位专业存在
-- ============================================================
-- 占位教师的 major_id 是 NOT NULL 且有 fk_teachers_major 外键，必须先有一个可指的专业。
-- V69:15-16 已经插过 __UNASSIGNED__，这里只是防止那一步也被人工跳过。
SET @sql = IF(
    @needs_repair = 1,
    'INSERT INTO majors (code, name, status) SELECT ''__UNASSIGNED__'', ''待分配专业'', ''DISABLED'' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM majors m WHERE m.code = ''__UNASSIGNED__'')',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- 第二步：为孤儿 classes 补占位 teachers 行
-- ============================================================
-- 这里刻意选择"补占位教师"而不是"重新指派给某个现有教师"：
-- classes.teacher_id 承载的是班级归属关系，随手改指会让班级凭空易主，
-- 而插入一行 id 与原 teacher_id 完全相同的占位记录，既能让 ADD CONSTRAINT 通过，
-- 又完整保留了原始归属，管理员后续可以在教师管理里认领或改派。
-- 占位行的特征：
--   * status = 'DISABLED'，不会出现在任何可选教师列表里；
--   * username 带 __orphan_teacher_ 前缀，一眼可辨且不会与真实账号冲突；
--   * password_hash 是一个非 bcrypt 字面量，PasswordEncoder.matches() 永远返回 false，
--     即使有人猜到用户名也无法登录；
--   * teacher_no / email 留 NULL —— 这两列虽有唯一索引，但 MySQL 允许多个 NULL 并存。
SET @sql = IF(
    @needs_repair = 1,
    'INSERT INTO teachers (id, username, password_hash, display_name, major_id, status)
     SELECT DISTINCT
         c.teacher_id,
         CONCAT(''__orphan_teacher_'', c.teacher_id),
         ''!ORPHAN_PLACEHOLDER_NO_LOGIN!'',
         CONCAT(''待认领教师 #'', c.teacher_id),
         (SELECT m.id FROM majors m WHERE m.code = ''__UNASSIGNED__'' ORDER BY m.id LIMIT 1),
         ''DISABLED''
     FROM classes c
     WHERE c.teacher_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM teachers t WHERE t.id = c.teacher_id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- 第三步：补建外键
-- ============================================================
-- 走到这里 classes.teacher_id 已经保证全部能在 teachers 里找到对应行，
-- ADD CONSTRAINT 不会再抛 errno 1452。守卫条件仍是 @needs_repair，
-- 外键已存在的库直接跳过，迁移可重复执行。
SET @sql = IF(
    @needs_repair = 1,
    'ALTER TABLE classes ADD CONSTRAINT fk_classes_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- 运维说明：V69 真的失败了的库该怎么办
-- ============================================================
-- 本文件跑不到那种库，必须人工处理，顺序如下：
--   1. 先备份整库。
--   2. 对照 V69 的语句逐条检查，把 V69 里失败点之后还没执行的语句补执行完
--      （failed 点是 V69:48 的 ADD CONSTRAINT fk_classes_teacher，
--       此前 majors/teachers 已建、fk_classes_teacher_user 已删）。
--      补 fk_classes_teacher 之前先按本文件第一、二步的思路补占位 teachers 行。
--   3. 执行 flyway repair 清掉 flyway_schema_history 里 success = 0 的 V69 记录，
--      再手工插入一条 V69 的成功记录（否则 repair 后 Flyway 会重跑 V69，
--      而 V69 第 3 行 CREATE TABLE majors 会因表已存在再次失败）。
--   4. 之后再正常 migrate，V73-V77 会自动接上；本文件会在第三步发现外键已在位而跳过。

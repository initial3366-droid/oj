-- V75: 为 users 表增加软删除列
--
-- 背景：管理员删除用户的功能对任何产生过业务数据的账号永久失效。
-- 指向 users(id) 的外键共 8 条，其中 6 条没有 ON DELETE 子句（MySQL 默认 RESTRICT）：
--     submissions.fk_submissions_user            RESTRICT
--     submission 相关的 user_problem_status      RESTRICT
--     user_scores / sandbox_runs                 RESTRICT
--     contest_registrations / tab_switch_logs    RESTRICT
--     class_members / class_join_applications    CASCADE（仅这两条会级联）
-- 只要用户提交过一次代码，物理 DELETE 必然抛 errno 1451 (Cannot delete or update
-- a parent row: a foreign key constraint fails)。
--
-- V16/V17/V18 已经给 problems / practices / contests 引入了同一套软删除方案，
-- 本迁移让 users 与它们保持完全一致的列名与类型，Java 侧即可用 @TableLogic 接管。
--
-- 列定义刻意抄用 V16/V17/V18 的写法：BOOLEAN 在 MySQL 中就是 TINYINT(1) 的别名，
-- 落库后与 problems.is_deleted / practices.is_deleted / contests.is_deleted 完全同型：
--     is_deleted  tinyint(1)  NOT NULL  DEFAULT '0'
--     deleted_at  datetime    NULL
-- 默认值 0 也正好对应 MyBatis-Plus @TableLogic 的默认约定
-- （logic-not-delete-value=0 / logic-delete-value=1），无需额外配置。
--
-- 注意（本迁移刻意不处理，留给业务层决策）：users 的 username / student_no / email
-- 仍是唯一索引，软删除后这些标识依然被占用，同名账号无法再次注册。
-- 若需要放开，应在业务层改注册校验，而不是拆掉唯一约束。

SET @schema_name = DATABASE();

-- 1. 增加 is_deleted 列。守卫：列已存在时跳过，保证可重复执行。
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'is_deleted'
    ),
    'ALTER TABLE users ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE COMMENT ''是否已删除''',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. 增加 deleted_at 列，与 V16/V17/V18 的配套字段保持一致，便于审计与恢复。
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'deleted_at'
    ),
    'ALTER TABLE users ADD COLUMN deleted_at DATETIME NULL COMMENT ''删除时间''',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. 兜底：若历史上曾有人手工补过可空的 is_deleted 列，把 NULL 归一成 0，
--    避免 @TableLogic 把 NULL 行当成"既非已删除也非未删除"而查不出来。
UPDATE users SET is_deleted = 0 WHERE is_deleted IS NULL;

-- 4. 配套索引。启用 @TableLogic 后，users 的每条查询都会被自动追加 is_deleted = 0，
--    管理端用户列表（UserAdminService:73-88）的固定形态是
--        WHERE is_deleted = 0 AND role = ? ORDER BY created_at DESC
--    因此建 (is_deleted, role, created_at DESC) 三列复合索引，
--    与 V20 给 contests 建的 idx_contests_deleted_status_time (is_deleted, status, start_time DESC)
--    是同一套思路：不建单列 is_deleted 索引（区分度太低，V20 已把那种索引全部删掉了）。
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'users'
          AND INDEX_NAME = 'idx_users_deleted_role_created'
    ),
    'CREATE INDEX idx_users_deleted_role_created ON users (is_deleted, role, created_at DESC)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- V78: 删除用户时级联清除其全部个人数据
--
-- 背景：管理员删除用户的功能对任何提交过代码的账号永久失效。
-- 指向 users(id) 的外键有十余条且绝大多数没写 ON DELETE 子句（默认 RESTRICT），
-- 而 UserAdminService.delete() 只清理了 user_scores 一张子表就物理删除 users 行，
-- MySQL 必然抛 errno 1451，@Transactional 整体回滚，管理员只看到一个无信息的 500。
-- 一条提交、一次沙箱运行或一次比赛报名，就足以让账号永久无法删除。
--
-- V75 曾为此给 users 加了软删除列作为过渡方案，但产品决策是「删号后所有信息全部删除」，
-- 因此本迁移把清理下沉到数据库：个人数据随用户行级联删除，由数据库保证不漏表、不依赖调用顺序。
-- V75 的 is_deleted 列保留不动（删除它需要先摘掉 @TableLogic 且对存量数据无收益），
-- 只是不再被写入。
--
-- 删除规则的选择依据：
--   * 个人数据（提交、沙箱运行、切屏日志、报名、参赛、积分、做题状态、社团成员）
--     用 ON DELETE CASCADE —— 这些行脱离了用户就没有任何意义。
--   * 共享内容（problems / contests / practices 的 owner_id）**刻意不建外键、也不级联**。
--     这三张表的 owner_id 是多态引用：归属方由 owner_account_type 区分（USER/TEACHER/ADMIN），
--     指向 users 的外键早已随该设计移除，实际 schema 里一条都不剩。
--     后果是删除用户不会报错，而是静默留下孤儿内容——这些是全站在用的公共题库，
--     级联删除更会造成灾难性丢失。因此唯一的防线在 Java 侧：
--     UserAdminService.assertNoOwnedContent 会先按 (owner_id, owner_account_type='USER') 计数，
--     命中就拒绝删除并提示「该用户仍拥有 N 个题目，请先转移归属」。
--     注意必须带上 owner_account_type：V69 之后教师迁到独立的 teachers 表，两表 id 会撞号。
--   * 两条指向 submissions 的外键改 SET NULL 而非 CASCADE：
--     user_problem_status 自身已随 user_id 级联删除，但 MySQL 不保证两条级联路径的先后，
--     若 last_submission_id 仍是 RESTRICT，删 submissions 时可能被尚未删除的
--     user_problem_status 行挡住。改成 SET NULL 可彻底消除这个顺序依赖。
--
-- 幂等性：每条 ALTER 前都用 information_schema 判断当前删除规则，
-- 已经是目标状态就跳过，可重复执行。

SET @schema_name = DATABASE();

-- ============================================================
-- 第一步：先清理孤儿行
-- ============================================================
-- MySQL 在 ADD CONSTRAINT 时会立刻校验存量数据，只要有一行悬空引用就抛 errno 1452
-- 让整个迁移失败（V69:48 正是踩了这个坑）。历史上 V42 曾硬删除过一批用户，
-- 那时多数子表还没有外键约束，因此可能残留指向已消失用户的行。

DELETE s FROM submissions s
    LEFT JOIN users u ON u.id = s.user_id
    WHERE s.user_id IS NOT NULL AND u.id IS NULL;

DELETE r FROM sandbox_runs r
    LEFT JOIN users u ON u.id = r.user_id
    WHERE r.user_id IS NOT NULL AND u.id IS NULL;

DELETE t FROM tab_switch_logs t
    LEFT JOIN users u ON u.id = t.user_id
    WHERE t.user_id IS NOT NULL AND u.id IS NULL;

DELETE cr FROM contest_registrations cr
    LEFT JOIN users u ON u.id = cr.user_id
    WHERE cr.user_id IS NOT NULL AND u.id IS NULL;

DELETE us FROM user_scores us
    LEFT JOIN users u ON u.id = us.user_id
    WHERE us.user_id IS NOT NULL AND u.id IS NULL;

DELETE ups FROM user_problem_status ups
    LEFT JOIN users u ON u.id = ups.user_id
    WHERE ups.user_id IS NOT NULL AND u.id IS NULL;

-- 提交用例结果随提交走；上面刚删过孤儿提交，这里把新产生的孤儿用例一并带走
DELETE scr FROM submission_case_results scr
    LEFT JOIN submissions s ON s.id = scr.submission_id
    WHERE scr.submission_id IS NOT NULL AND s.id IS NULL;

-- last_submission_id 指向已消失的提交时置空，否则改成 SET NULL 外键时会被存量数据挡住
UPDATE user_problem_status ups
    LEFT JOIN submissions s ON s.id = ups.last_submission_id
    SET ups.last_submission_id = NULL
    WHERE ups.last_submission_id IS NOT NULL AND s.id IS NULL;

-- ============================================================
-- 第二步：把个人数据外键改为 ON DELETE CASCADE
-- ============================================================
-- 统一的改法：存在则先 DROP 再按目标规则重建。用 DELETE_RULE 判断是否已达目标状态。

-- 2.1 submissions.user_id
SET @rule = (
    SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = @schema_name AND CONSTRAINT_NAME = 'fk_submissions_user'
);
SET @sql = IF(@rule IS NOT NULL AND @rule <> 'CASCADE',
    'ALTER TABLE submissions DROP FOREIGN KEY fk_submissions_user',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(@rule IS NULL OR @rule <> 'CASCADE',
    'ALTER TABLE submissions ADD CONSTRAINT fk_submissions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2.2 submission_case_results.submission_id（随提交级联，否则删提交时被挡住）
SET @rule = (
    SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = @schema_name AND CONSTRAINT_NAME = 'fk_submission_cases_submission'
);
SET @sql = IF(@rule IS NOT NULL AND @rule <> 'CASCADE',
    'ALTER TABLE submission_case_results DROP FOREIGN KEY fk_submission_cases_submission',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(@rule IS NULL OR @rule <> 'CASCADE',
    'ALTER TABLE submission_case_results ADD CONSTRAINT fk_submission_cases_submission FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2.3 user_problem_status.last_submission_id -> SET NULL（消除两条级联路径的顺序依赖）
SET @rule = (
    SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = @schema_name AND CONSTRAINT_NAME = 'fk_user_problem_status_submission'
);
SET @sql = IF(@rule IS NOT NULL AND @rule <> 'SET NULL',
    'ALTER TABLE user_problem_status DROP FOREIGN KEY fk_user_problem_status_submission',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(@rule IS NULL OR @rule <> 'SET NULL',
    'ALTER TABLE user_problem_status ADD CONSTRAINT fk_user_problem_status_submission FOREIGN KEY (last_submission_id) REFERENCES submissions(id) ON DELETE SET NULL',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2.4 user_problem_status.user_id
SET @rule = (
    SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = @schema_name AND CONSTRAINT_NAME = 'fk_user_problem_status_user'
);
SET @sql = IF(@rule IS NOT NULL AND @rule <> 'CASCADE',
    'ALTER TABLE user_problem_status DROP FOREIGN KEY fk_user_problem_status_user',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(@rule IS NULL OR @rule <> 'CASCADE',
    'ALTER TABLE user_problem_status ADD CONSTRAINT fk_user_problem_status_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2.5 sandbox_runs.user_id
SET @rule = (
    SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = @schema_name AND CONSTRAINT_NAME = 'fk_sandbox_runs_user'
);
SET @sql = IF(@rule IS NOT NULL AND @rule <> 'CASCADE',
    'ALTER TABLE sandbox_runs DROP FOREIGN KEY fk_sandbox_runs_user',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(@rule IS NULL OR @rule <> 'CASCADE',
    'ALTER TABLE sandbox_runs ADD CONSTRAINT fk_sandbox_runs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2.6 tab_switch_logs.user_id
SET @rule = (
    SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = @schema_name AND CONSTRAINT_NAME = 'fk_tab_switch_logs_user'
);
SET @sql = IF(@rule IS NOT NULL AND @rule <> 'CASCADE',
    'ALTER TABLE tab_switch_logs DROP FOREIGN KEY fk_tab_switch_logs_user',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(@rule IS NULL OR @rule <> 'CASCADE',
    'ALTER TABLE tab_switch_logs ADD CONSTRAINT fk_tab_switch_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2.7 contest_registrations.user_id
SET @rule = (
    SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = @schema_name AND CONSTRAINT_NAME = 'fk_contest_registrations_user'
);
SET @sql = IF(@rule IS NOT NULL AND @rule <> 'CASCADE',
    'ALTER TABLE contest_registrations DROP FOREIGN KEY fk_contest_registrations_user',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(@rule IS NULL OR @rule <> 'CASCADE',
    'ALTER TABLE contest_registrations ADD CONSTRAINT fk_contest_registrations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2.8 user_scores.user_id
SET @rule = (
    SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = @schema_name AND CONSTRAINT_NAME = 'fk_user_scores_user'
);
SET @sql = IF(@rule IS NOT NULL AND @rule <> 'CASCADE',
    'ALTER TABLE user_scores DROP FOREIGN KEY fk_user_scores_user',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(@rule IS NULL OR @rule <> 'CASCADE',
    'ALTER TABLE user_scores ADD CONSTRAINT fk_user_scores_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2.9 contest_participants.user_id（V76 刚建，规则是 RESTRICT）
--      参赛者行级联删除后，四张排名缓存表会通过 V76 建立的 CASCADE 外键自动带走。
SET @rule = (
    SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = @schema_name AND CONSTRAINT_NAME = 'fk_contest_participants_user'
);
SET @sql = IF(@rule IS NOT NULL AND @rule <> 'CASCADE',
    'ALTER TABLE contest_participants DROP FOREIGN KEY fk_contest_participants_user',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(@rule IS NULL OR @rule <> 'CASCADE',
    'ALTER TABLE contest_participants ADD CONSTRAINT fk_contest_participants_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 说明：V1 建过的 contest_standings / club_members / home_daily_problem_config 三张表
-- 分别已被 V22、V47、V38 删除，其指向 users 的外键随表一并消失，因此本迁移不涉及它们。

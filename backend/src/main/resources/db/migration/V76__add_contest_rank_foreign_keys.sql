-- V76: 为 contest_participants 与四张排名缓存表补齐外键约束
--
-- 背景：V15:154-172 建 contest_participants、V15:341-411 建四张排名缓存表时，
-- contest_id / user_id / participant_id / contest_problem_id 全部是裸 BIGINT，
-- 一条外键都没有。造成的实际问题：
--   1) ContestService.delete()（ContestService.java:2265）只把 contests.is_deleted 置 1，
--      从不清理 contest_participants 与排名行，排名数据无限累积；
--   2) V42:72-93 和 V69:229-241 不得不手写四段级联 DELETE 来擦屁股，
--      每次改数据模型都要重写一遍同样的清理逻辑；
--   3) ContestAcmRankService.recalculateRanks（:214）逐行调用
--      participantMapper.selectById(rank.participantId) 时会静默拿到 null，
--      排名照算但 starred 判定直接丢失，错误被完全吞掉。
--
-- 本迁移把这套约束下沉到数据库：排名行随参赛者行级联删除，参赛者行则被
-- 比赛与用户约束住不能悬空。
--
-- 删除规则的选择依据：
--   * 四张排名表 -> contest_participants 用 ON DELETE CASCADE。
--     排名表是可重算的缓存（ContestAcmRankService 有全量重建入口），
--     参赛者没了排名行就毫无意义，级联删除正是 V42/V69 手写 DELETE 想做的事。
--   * contest_participants -> contests / users 用 RESTRICT（不写 ON DELETE 子句）。
--     理由是与既有约定一致：现有 6 条指向 contests 的外键
--     （contest_problems / contest_registrations / contest_audiences /
--      contest_problem_case_scores / submissions / tab_switch_logs）全是 RESTRICT，
--     且比赛与用户在业务上都只做软删除（contests 见 V18，users 见 V75），
--     这里改成 CASCADE 反而会在将来某次误操作里悄悄抹掉参赛与排名历史。
--
-- 关键前置：MySQL 在 ADD CONSTRAINT 时会立刻校验存量数据，只要有一行悬空引用
-- 就抛 errno 1452 让整个迁移失败（V69:48 就是踩了这个坑）。所以每个外键之前
-- 都必须先把对应的孤儿行清干净。清理顺序也有讲究：先删孤儿参赛者，再删孤儿排名行，
-- 这样第一步新产生的孤儿排名行会被第二步一并带走。

SET @schema_name = DATABASE();

-- ============================================================
-- 第一步：清理孤儿数据（必须早于所有 ADD CONSTRAINT）
-- ============================================================

-- 1.1 删除 contest_id 指向不存在比赛的参赛者行。
--     比赛记录整行消失（非软删除）后，这些参赛记录既查不到比赛名也进不了任何榜单。
--     注意：submissions.participant_id 上已有 fk_submissions_participant
--     ON DELETE SET NULL（V20:188），因此关联提交本身会保留，只是解除参赛者绑定。
DELETE FROM contest_participants
WHERE NOT EXISTS (
    SELECT 1 FROM contests c WHERE c.id = contest_participants.contest_id
);

-- 1.2 删除 user_id 指向不存在用户的参赛者行。
--     历史上 V42:169 与 V69:253 硬删过 users 行，可能留下这类悬空记录；
--     它们在榜单上连用户名都渲染不出来，属于确定无用的残留。
DELETE FROM contest_participants
WHERE NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = contest_participants.user_id
);

-- 1.3 删除四张排名表中 participant_id 已悬空的行（含 1.1/1.2 刚刚制造出来的）。
--     排名表是纯缓存，删掉可由 ContestAcmRankService / ContestOiRankService 重算。
DELETE FROM contest_acm_rank_cache
WHERE NOT EXISTS (
    SELECT 1 FROM contest_participants cp WHERE cp.id = contest_acm_rank_cache.participant_id
);

DELETE FROM contest_acm_rank_problems
WHERE NOT EXISTS (
    SELECT 1 FROM contest_participants cp WHERE cp.id = contest_acm_rank_problems.participant_id
);

DELETE FROM contest_oi_rank_cache
WHERE NOT EXISTS (
    SELECT 1 FROM contest_participants cp WHERE cp.id = contest_oi_rank_cache.participant_id
);

DELETE FROM contest_oi_rank_problems
WHERE NOT EXISTS (
    SELECT 1 FROM contest_participants cp WHERE cp.id = contest_oi_rank_problems.participant_id
);

-- ============================================================
-- 第二步：为两张 *_rank_cache 表补 participant_id 前导索引
-- ============================================================
-- contest_acm_rank_cache / contest_oi_rank_cache 只有 uk_contest_participant
-- (contest_id, participant_id)，前导列是 contest_id，无法给 participant_id 上的外键用。
-- 不显式建索引 MySQL 也会自动补一个同名于约束的索引，但那样命名不可控，
-- 这里主动建成与两张 *_rank_problems 表一致的 idx_participant。
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_acm_rank_cache'
          AND INDEX_NAME = 'idx_participant'
    ),
    'CREATE INDEX idx_participant ON contest_acm_rank_cache (participant_id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_oi_rank_cache'
          AND INDEX_NAME = 'idx_participant'
    ),
    'CREATE INDEX idx_participant ON contest_oi_rank_cache (participant_id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- 第三步：contest_participants 的两条外键
-- ============================================================
-- 守卫统一写法：查 information_schema.TABLE_CONSTRAINTS 里是否已有同名 FOREIGN KEY，
-- 有则跳过，保证迁移可重复执行。

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_participants'
          AND CONSTRAINT_NAME = 'fk_contest_participants_contest'
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ),
    'ALTER TABLE contest_participants ADD CONSTRAINT fk_contest_participants_contest FOREIGN KEY (contest_id) REFERENCES contests(id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_participants'
          AND CONSTRAINT_NAME = 'fk_contest_participants_user'
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ),
    'ALTER TABLE contest_participants ADD CONSTRAINT fk_contest_participants_user FOREIGN KEY (user_id) REFERENCES users(id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- 第四步：四张排名表 -> contest_participants 的级联外键
-- ============================================================

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_acm_rank_cache'
          AND CONSTRAINT_NAME = 'fk_acm_rank_cache_participant'
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ),
    'ALTER TABLE contest_acm_rank_cache ADD CONSTRAINT fk_acm_rank_cache_participant FOREIGN KEY (participant_id) REFERENCES contest_participants(id) ON DELETE CASCADE',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_acm_rank_problems'
          AND CONSTRAINT_NAME = 'fk_acm_rank_problems_participant'
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ),
    'ALTER TABLE contest_acm_rank_problems ADD CONSTRAINT fk_acm_rank_problems_participant FOREIGN KEY (participant_id) REFERENCES contest_participants(id) ON DELETE CASCADE',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_oi_rank_cache'
          AND CONSTRAINT_NAME = 'fk_oi_rank_cache_participant'
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ),
    'ALTER TABLE contest_oi_rank_cache ADD CONSTRAINT fk_oi_rank_cache_participant FOREIGN KEY (participant_id) REFERENCES contest_participants(id) ON DELETE CASCADE',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_oi_rank_problems'
          AND CONSTRAINT_NAME = 'fk_oi_rank_problems_participant'
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ),
    'ALTER TABLE contest_oi_rank_problems ADD CONSTRAINT fk_oi_rank_problems_participant FOREIGN KEY (participant_id) REFERENCES contest_participants(id) ON DELETE CASCADE',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 说明：本迁移刻意不给排名表的 contest_problem_id 加外键。
-- contest_problems 行会随比赛题目调整被真删（ContestService 的题目移除逻辑），
-- 若加上 RESTRICT 会直接卡死改题操作，若加 CASCADE 又会在改题时静默抹掉历史排名，
-- 两种语义都不安全，留给业务层决定。

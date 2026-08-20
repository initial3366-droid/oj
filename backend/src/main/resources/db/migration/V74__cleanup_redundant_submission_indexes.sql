-- V74: 清理 submissions 表上的冗余索引，并统一 idx_user_status_time 的定义
--
-- 背景：submissions 是全库写入最频繁的表，V73 之前已挂了 18 个二级索引，
-- 每一次 INSERT/UPDATE 都要维护全部索引，写放大严重。经核对实际查询后，
-- 以下两个索引可证明冗余，另有一个索引在两处迁移里被重复定义。

SET @schema_name = DATABASE();

-- ============================================================
-- 1. 删除 idx_submission_queue_status_time (status, priority, submit_time)
-- ============================================================
-- 该索引由 V29:98 建立，三列全为升序。但判题队列的实际取件语句
-- （SubmissionMapper.java:83/97/135）都是
--     WHERE status IN (...) ORDER BY priority DESC, submit_time ASC
-- 升序的 priority 列无法消除这个混合方向排序的 filesort。
-- V31:28 建立的 idx_submission_status_submit (status ASC, priority DESC, submit_time ASC)
-- 方向完全匹配，且以相同的 status 列前导，能覆盖本索引的全部等值/范围查找场景。
-- 因此本索引纯属重复维护成本，删除。
SET @sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'submissions'
          AND INDEX_NAME = 'idx_submission_queue_status_time'
    ),
    'DROP INDEX idx_submission_queue_status_time ON submissions',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 保险：确认 V31 的替代索引确实在位后才算安全。若因历史原因缺失则补建，
-- 避免上面的 DROP 让判题队列失去唯一可用索引。
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'submissions'
          AND INDEX_NAME = 'idx_submission_status_submit'
    ),
    'CREATE INDEX idx_submission_status_submit ON submissions (status ASC, priority DESC, submit_time ASC)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- 2. 删除 idx_submission_queue_filters
--    (contest_id, problem_id, user_id, language, judge_server)
-- ============================================================
-- 该索引由 V29:110 建立，是一个五列宽索引。管理端提交列表的过滤条件是可选组合，
-- B+Tree 只能利用其最左连续前缀，实际上唯一稳定可用的就是前导列 contest_id，
-- 而 contest_id 前导的索引另有五个：
--     idx_contest_submit_time (contest_id, submit_time)          -- V15
--     idx_frozen (contest_id, is_frozen)                          -- V15
--     idx_submission_status (contest_id, status)                  -- V20 前既有
--     idx_submissions_contest_problem (contest_id, contest_problem_id)
--     idx_submissions_contest_user (contest_id, user_id)
-- 且管理端列表始终按 submit_time 排序，本索引任何情况下都无法避免 filesort。
-- 剩余的 (contest_id, problem_id) 组合虽无专用索引，但 problem_id 前导的
-- idx_problem_status 与 idx_submissions_user_problem_status 已能支撑题目维度查询。
-- 综合判断收益远低于五列索引的写入维护成本，删除。
SET @sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'submissions'
          AND INDEX_NAME = 'idx_submission_queue_filters'
    ),
    'DROP INDEX idx_submission_queue_filters ON submissions',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- 3. 统一 idx_user_status_time 的定义
-- ============================================================
-- 该索引被定义了两次且末列方向相反：
--     V20:19  CREATE INDEX idx_user_status_time ON submissions(user_id, status, created_at DESC)
--     V22:18  ALTER TABLE submissions ADD INDEX idx_user_status_time (user_id, status, created_at)
-- 两处都带 NOT EXISTS 守卫，所以谁先跑谁生效。全新安装按序执行时 V20 先建立降序版本，
-- V22 跳过；但若某套库历史上先落到 V22（例如从旧基线补迁移），生效的就是升序版本，
-- 同一条 "按用户查提交历史、按时间倒序" 的查询在不同环境会得到不同执行计划。
-- 这里统一收敛到 V20 的降序定义：先按需删除非规范定义，再补建规范定义。

-- 3.1 统计现有索引的列数，以及与规范定义 (user_id ASC, status ASC, created_at DESC) 相符的列数。
--     information_schema.STATISTICS.COLLATION 为 'A' 表示升序，'D' 表示降序。
SET @idx_total = (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'submissions'
      AND INDEX_NAME = 'idx_user_status_time'
);
SET @idx_canonical = (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'submissions'
      AND INDEX_NAME = 'idx_user_status_time'
      AND (
            (SEQ_IN_INDEX = 1 AND COLUMN_NAME = 'user_id'    AND COLLATION = 'A')
         OR (SEQ_IN_INDEX = 2 AND COLUMN_NAME = 'status'     AND COLLATION = 'A')
         OR (SEQ_IN_INDEX = 3 AND COLUMN_NAME = 'created_at' AND COLLATION = 'D')
      )
);

-- 3.2 守卫：索引存在但与规范定义不符（列数不是 3，或有列不匹配）时才删除。
--     索引本就不存在（@idx_total = 0）或已经是规范形态时都不动，保证可重复执行。
SET @sql = IF(
    @idx_total > 0 AND (@idx_total <> 3 OR @idx_canonical <> 3),
    'DROP INDEX idx_user_status_time ON submissions',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3.3 守卫：索引缺失时（原本没有，或刚被 3.2 删掉）按 V20 的降序定义重建。
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'submissions'
          AND INDEX_NAME = 'idx_user_status_time'
    ),
    'CREATE INDEX idx_user_status_time ON submissions (user_id, status, created_at DESC)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

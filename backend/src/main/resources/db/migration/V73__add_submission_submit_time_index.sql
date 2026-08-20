-- V73: 为 submissions.submit_time 补充前导列索引
--
-- 背景：submit_time 是管理端提交列表的默认排序列（SubmissionService.applyAdminSorting
-- 的 default 分支返回 "submit_time"，默认降序），同时也是日期范围过滤列（from/to 参数）。
-- 但现有 4 个包含 submit_time 的索引都把它放在非前导位置，无法支撑以它为唯一排序键的查询：
--   idx_contest_submit_time              (contest_id, submit_time)                  -- V15
--   idx_submission_queue_status_time     (status, priority, submit_time)            -- V29
--   idx_submission_status_submit         (status, priority DESC, submit_time ASC)   -- V31
--   idx_submissions_judge_backend_status (judge_backend, status, priority, submit_time) -- V66
-- 结果：管理员打开提交列表和翻页时每次都要全表扫描 + filesort，随提交量线性劣化。
--
-- 本次改动新增以 submit_time 为前导列的降序索引，让默认排序与分页走索引扫描。
-- 方向选 DESC 与业务默认排序（最新提交在前）一致，MySQL 8.0 支持真正的降序索引。

SET @schema_name = DATABASE();

-- 守卫：仅当同名索引不存在时才创建，保证迁移可重复执行。
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'submissions'
          AND INDEX_NAME = 'idx_submissions_submit_time'
    ),
    'CREATE INDEX idx_submissions_submit_time ON submissions (submit_time DESC)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

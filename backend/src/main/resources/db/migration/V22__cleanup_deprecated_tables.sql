-- V22: 清理废弃表和优化表结构
-- 删除已被替代的废弃表

-- 1. 删除废弃的榜单表（已被 contest_acm_rank_cache 和 contest_oi_rank_cache 替代）
DROP TABLE IF EXISTS _deprecated_contest_standings;

-- 2. 确保所有必要的索引都存在

-- submissions 表索引（如果 V20 未添加）
SET @sql = IF(
    NOT EXISTS (
        SELECT 1
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'submissions'
          AND INDEX_NAME = 'idx_user_status_time'
    ),
    'ALTER TABLE submissions ADD INDEX idx_user_status_time (user_id, status, created_at)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'submissions'
          AND INDEX_NAME = 'idx_problem_status'
    ),
    'ALTER TABLE submissions ADD INDEX idx_problem_status (problem_id, status)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. 添加表注释（确保语义清晰）
ALTER TABLE contest_acm_rank_cache
COMMENT 'ACM 比赛榜单缓存表（实时更新）';

ALTER TABLE contest_oi_rank_cache
COMMENT 'OI 比赛榜单缓存表（实时更新）';

ALTER TABLE contest_acm_rank_problems
COMMENT 'ACM 比赛单题状态表（每个参赛者每题的详细状态）';

ALTER TABLE contest_oi_rank_problems
COMMENT 'OI 比赛单题分数表（每个参赛者每题的最高分）';

-- 4. 验证关键表存在
SELECT
    'Database migration V22 completed successfully' as status,
    (SELECT COUNT(*) FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = '_deprecated_contest_standings') as deprecated_tables_count,
    (SELECT COUNT(*) FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'submission_cases') as old_submission_cases_count,
    (SELECT COUNT(*) FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME IN ('contest_acm_rank_cache', 'contest_oi_rank_cache')) as rank_tables_count;

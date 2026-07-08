-- V21: 统一提交测试点结果表
-- 修复 submission_cases 和 submission_case_results 重复问题

-- 1. 检查并迁移数据（如果 submission_cases 表存在）
INSERT INTO submission_case_results (
    submission_id,
    case_no,
    status,
    time_used,
    memory_used,
    score,
    judge_message,
    created_at
)
SELECT
    sc.submission_id,
    sc.case_no,
    sc.status,
    COALESCE(sc.time_ms, 0),
    COALESCE(sc.memory_kb, 0),
    0 as score,
    NULL as judge_message,
    NOW() as created_at
FROM submission_cases sc
WHERE NOT EXISTS (
    SELECT 1
    FROM submission_case_results scr
    WHERE scr.submission_id = sc.submission_id
      AND scr.case_no = sc.case_no
)
AND EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'submission_cases'
);

-- 2. 删除旧表（如果存在）
DROP TABLE IF EXISTS submission_cases;

-- 3. 更新表注释
ALTER TABLE submission_case_results
COMMENT '提交测试点结果表（统一表，已整合旧的 submission_cases 数据）';

-- 4. 确保索引完整
SET @index_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'submission_case_results'
    AND INDEX_NAME = 'idx_submission_case_results_submission'
);

SET @sql = IF(
    @index_exists = 0,
    'ALTER TABLE submission_case_results ADD INDEX idx_submission_case_results_submission (submission_id)',
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

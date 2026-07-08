-- ========================================
-- V20: 数据库架构优化
-- 优化索引、添加约束、提升性能
-- ========================================

SET @schema_name = DATABASE();

-- ========================================
-- PART 1: 添加缺失的复合索引（CRITICAL）
-- ========================================

-- 1.1 submissions 表性能索引
-- 用户提交历史查询：WHERE user_id = ? AND status = 'AC' ORDER BY created_at DESC
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'submissions' AND INDEX_NAME = 'idx_user_status_time'
    ),
    'CREATE INDEX idx_user_status_time ON submissions(user_id, status, created_at DESC)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 题目AC率统计：WHERE problem_id = ? AND status = 'AC'
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'submissions' AND INDEX_NAME = 'idx_problem_status'
    ),
    'CREATE INDEX idx_problem_status ON submissions(problem_id, status)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 提交时间查询：ORDER BY created_at DESC
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'submissions' AND INDEX_NAME = 'idx_submissions_created_at'
    ),
    'CREATE INDEX idx_submissions_created_at ON submissions(created_at DESC)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.2 contest_registrations 表索引
-- 用户报名历史：WHERE user_id = ?
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contest_registrations' AND INDEX_NAME = 'idx_contest_registrations_user'
    ),
    'CREATE INDEX idx_contest_registrations_user ON contest_registrations(user_id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.3 user_problem_status 表索引
-- 用户AC题目列表：WHERE user_id = ? AND best_status = 'AC'
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'user_problem_status' AND INDEX_NAME = 'idx_user_best_status'
    ),
    'CREATE INDEX idx_user_best_status ON user_problem_status(user_id, best_status)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.4 problems 表复合索引
-- 公开题目列表：WHERE is_public = TRUE AND is_deleted = FALSE
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'problems' AND INDEX_NAME = 'idx_problems_public_deleted'
    ),
    'CREATE INDEX idx_problems_public_deleted ON problems(is_public, is_deleted)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========================================
-- PART 2: 优化软删除索引（HIGH）
-- ========================================

-- 2.1 删除单列索引，添加复合索引
-- problems: 软删除 + 公开状态
SET @sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'problems' AND INDEX_NAME = 'idx_problems_is_deleted'
    ),
    'DROP INDEX idx_problems_is_deleted ON problems',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'problems' AND INDEX_NAME = 'idx_problems_deleted_public_difficulty'
    ),
    'CREATE INDEX idx_problems_deleted_public_difficulty ON problems(is_deleted, is_public, difficulty)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2.2 contests: 软删除 + 状态 + 开始时间
SET @sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contests' AND INDEX_NAME = 'idx_contests_is_deleted'
    ),
    'DROP INDEX idx_contests_is_deleted ON contests',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contests' AND INDEX_NAME = 'idx_contests_deleted_status_time'
    ),
    'CREATE INDEX idx_contests_deleted_status_time ON contests(is_deleted, status, start_time DESC)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2.3 practices: 软删除 + 发布状态
SET @sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'practices' AND INDEX_NAME = 'idx_practices_is_deleted'
    ),
    'DROP INDEX idx_practices_is_deleted ON practices',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'practices' AND INDEX_NAME = 'idx_practices_deleted_published'
    ),
    'CREATE INDEX idx_practices_deleted_published ON practices(is_deleted, published)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========================================
-- PART 3: 添加时间范围查询索引（MEDIUM）
-- ========================================

-- 3.1 contests 时间范围查询
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contests' AND INDEX_NAME = 'idx_contests_time_range'
    ),
    'CREATE INDEX idx_contests_time_range ON contests(start_time, end_time)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3.2 contest_participants 报名时间查询
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contest_participants' AND INDEX_NAME = 'idx_participants_registered_at'
    ),
    'CREATE INDEX idx_participants_registered_at ON contest_participants(registered_at DESC)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========================================
-- PART 4: 添加外键约束（CRITICAL，谨慎处理）
-- ========================================

-- 4.1 submissions.participant_id -> contest_participants.id
-- 注意：只为有效数据添加外键
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'submissions'
        AND CONSTRAINT_NAME = 'fk_submissions_participant' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ),
    'ALTER TABLE submissions ADD CONSTRAINT fk_submissions_participant
     FOREIGN KEY (participant_id) REFERENCES contest_participants(id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4.2 contest_problem_case_scores 主键优化
-- 确保主键包含所有必要字段
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contest_problem_case_scores'
        AND CONSTRAINT_NAME = 'PRIMARY'
        AND EXISTS (
            SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = @schema_name
            AND TABLE_NAME = 'contest_problem_case_scores'
            AND CONSTRAINT_NAME = 'PRIMARY'
            GROUP BY CONSTRAINT_NAME
            HAVING COUNT(*) = 3
        )
    ),
    'ALTER TABLE contest_problem_case_scores DROP PRIMARY KEY,
     ADD PRIMARY KEY (contest_id, problem_id, case_no)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========================================
-- PART 5: 添加唯一约束（MEDIUM）
-- ========================================

-- 5.1 home_daily_problem_config 应该只有一条记录
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'home_daily_problem_config'
        AND INDEX_NAME = 'uk_daily_problem_singleton'
    ),
    'ALTER TABLE home_daily_problem_config ADD UNIQUE KEY uk_daily_problem_singleton (id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5.2 practice_problems display_order 唯一性
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'practice_problems'
        AND INDEX_NAME = 'uk_practice_display_order'
    ),
    'ALTER TABLE practice_problems ADD UNIQUE KEY uk_practice_display_order (practice_id, display_order)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========================================
-- PART 6: 添加覆盖索引优化查询（HIGH）
-- ========================================

-- 6.1 user_scores 排行榜查询覆盖索引
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'user_scores'
        AND INDEX_NAME = 'idx_user_scores_ranking'
    ),
    'CREATE INDEX idx_user_scores_ranking ON user_scores(rating DESC, ac_count DESC, total_score DESC)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6.2 class_members 班级成员查询
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'class_members'
        AND INDEX_NAME = 'idx_class_members_class'
    ),
    'CREATE INDEX idx_class_members_class ON class_members(class_id, joined_at DESC)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6.3 club_members 社团成员查询
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'club_members'
        AND INDEX_NAME = 'idx_club_members_club'
    ),
    'CREATE INDEX idx_club_members_club ON club_members(club_id, joined_at DESC)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========================================
-- PART 7: 添加表注释（LOW，提升可维护性）
-- ========================================

ALTER TABLE users COMMENT '用户表';
ALTER TABLE admin_users COMMENT '管理员账户表（独立于用户表）';
ALTER TABLE classes COMMENT '班级/课程表';
ALTER TABLE class_members COMMENT '班级成员关系表';
ALTER TABLE clubs COMMENT '社团/俱乐部表';
ALTER TABLE club_members COMMENT '社团成员关系表';
ALTER TABLE tags COMMENT '题目标签表';
ALTER TABLE problems COMMENT '题库表';
ALTER TABLE problem_tags COMMENT '题目-标签关联表';
ALTER TABLE problem_test_cases COMMENT '题目测试用例表';
ALTER TABLE contests COMMENT '比赛表';
ALTER TABLE contest_problems COMMENT '比赛题目快照表（含题目内容副本）';
ALTER TABLE contest_registrations COMMENT '比赛报名表';
ALTER TABLE submissions COMMENT '代码提交表（包括普通提交、比赛提交、练习提交）';
ALTER TABLE submission_cases COMMENT '提交测试点结果表（旧版，已被 submission_case_results 替代）';
ALTER TABLE sandbox_runs COMMENT '沙盒运行记录表（在线运行代码）';
ALTER TABLE user_scores COMMENT '用户积分统计表';
ALTER TABLE user_problem_status COMMENT '用户-题目状态缓存表';
ALTER TABLE tab_switch_logs COMMENT '比赛切屏日志表';
ALTER TABLE home_daily_problem_config COMMENT '首页每日一题配置表';
ALTER TABLE home_carousel_slides COMMENT '首页轮播图配置表';
ALTER TABLE practices COMMENT '练习集表';
ALTER TABLE practice_problems COMMENT '练习集-题目关联表';
ALTER TABLE contest_audiences COMMENT '比赛受众范围表（支持多个范围）';
ALTER TABLE contest_problem_case_scores COMMENT '比赛题目测试点分数配置（OI赛制）';

-- ========================================
-- PART 8: 性能统计信息更新
-- ========================================

-- 更新表统计信息以优化查询计划
ANALYZE TABLE users, problems, contests, submissions, practices;
ANALYZE TABLE contest_participants, contest_registrations, user_problem_status;
ANALYZE TABLE contest_acm_rank_cache, contest_oi_rank_cache;

-- ========================================
-- 优化完成
-- ========================================

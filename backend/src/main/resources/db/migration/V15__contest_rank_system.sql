-- ========================================
-- QOJ Contest Rank System Migration
-- ACM/OI 双赛制排名系统
-- ========================================

-- 1. 修改 contests 表，添加赛制和排名相关配置
SET @schema_name = DATABASE();

-- 添加 scoring_mode
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contests' AND COLUMN_NAME = 'scoring_mode'
    ),
    'ALTER TABLE contests ADD COLUMN scoring_mode VARCHAR(16) NOT NULL DEFAULT ''ACM'' COMMENT ''ACM or OI'' AFTER type',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 添加 freeze_time
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contests' AND COLUMN_NAME = 'freeze_time'
    ),
    'ALTER TABLE contests ADD COLUMN freeze_time DATETIME NULL COMMENT ''封榜时间，NULL 表示不封榜'' AFTER end_time',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 添加 penalty_minutes
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contests' AND COLUMN_NAME = 'penalty_minutes'
    ),
    'ALTER TABLE contests ADD COLUMN penalty_minutes INT NOT NULL DEFAULT 20 COMMENT ''ACM 罚时（分钟）'' AFTER freeze_time',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 添加 count_ce_as_penalty
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contests' AND COLUMN_NAME = 'count_ce_as_penalty'
    ),
    'ALTER TABLE contests ADD COLUMN count_ce_as_penalty BOOLEAN NOT NULL DEFAULT FALSE COMMENT ''CE 是否计入罚时'' AFTER penalty_minutes',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 添加 scoreboard_scope
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contests' AND COLUMN_NAME = 'scoreboard_scope'
    ),
    'ALTER TABLE contests ADD COLUMN scoreboard_scope VARCHAR(32) NOT NULL DEFAULT ''PUBLIC'' COMMENT ''PUBLIC/CLASS/CLUB/ORGANIZATION'' AFTER count_ce_as_penalty',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 添加 scoreboard_visibility
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contests' AND COLUMN_NAME = 'scoreboard_visibility'
    ),
    'ALTER TABLE contests ADD COLUMN scoreboard_visibility VARCHAR(32) NOT NULL DEFAULT ''PUBLIC'' COMMENT ''PUBLIC/PARTICIPANT/ADMIN'' AFTER scoreboard_scope',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 添加 code_visibility
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contests' AND COLUMN_NAME = 'code_visibility'
    ),
    'ALTER TABLE contests ADD COLUMN code_visibility VARCHAR(32) NOT NULL DEFAULT ''AFTER_CONTEST'' COMMENT ''NEVER/AFTER_CONTEST/ALWAYS'' AFTER scoreboard_visibility',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 添加 enable_rolling_scoreboard
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contests' AND COLUMN_NAME = 'enable_rolling_scoreboard'
    ),
    'ALTER TABLE contests ADD COLUMN enable_rolling_scoreboard BOOLEAN NOT NULL DEFAULT FALSE COMMENT ''是否启用滚榜'' AFTER code_visibility',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 添加 registration_password
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contests' AND COLUMN_NAME = 'registration_password'
    ),
    'ALTER TABLE contests ADD COLUMN registration_password VARCHAR(255) NULL COMMENT ''报名密码（加密）'' AFTER registration_type',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. 修改 contest_problems 表（V13 已添加 id 等字段，这里只补充缺失的）
SET @schema_name = DATABASE();

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_problems'
          AND COLUMN_NAME = 'display_title'
    ),
    'ALTER TABLE contest_problems ADD COLUMN display_title VARCHAR(200) NULL COMMENT ''题目显示标题（可选）'' AFTER label',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_problems'
          AND COLUMN_NAME = 'full_score'
    ),
    'ALTER TABLE contest_problems ADD COLUMN full_score INT NOT NULL DEFAULT 100 COMMENT ''OI 满分'' AFTER score',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contest_problems'
          AND COLUMN_NAME = 'is_visible'
    ),
    'ALTER TABLE contest_problems ADD COLUMN is_visible BOOLEAN NOT NULL DEFAULT TRUE COMMENT ''是否对参赛者可见'' AFTER display_order',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. 创建参赛者表
CREATE TABLE contest_participants (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    contest_id BIGINT NOT NULL COMMENT '比赛ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    team_id BIGINT NULL COMMENT '团队ID（预留）',
    participant_type VARCHAR(32) NOT NULL DEFAULT 'INDIVIDUAL' COMMENT 'INDIVIDUAL/TEAM',
    nickname VARCHAR(100) NOT NULL COMMENT '参赛昵称',
    organization_id BIGINT NULL COMMENT '组织ID（预留）',
    class_id BIGINT NULL COMMENT '班级ID',
    identity_type VARCHAR(16) NULL COMMENT 'PERSONAL/CLASS/CLUB',
    identity_id BIGINT NULL COMMENT '身份ID',
    status VARCHAR(32) NOT NULL DEFAULT 'NORMAL' COMMENT 'NORMAL/BANNED/UNOFFICIAL',
    registered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_contest_user (contest_id, user_id),
    KEY idx_contest (contest_id),
    KEY idx_user (user_id),
    KEY idx_class (class_id)
) COMMENT '比赛参赛者表';

-- 4. 修改 submissions 表
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'participant_id'
    ),
    'ALTER TABLE submissions ADD COLUMN participant_id BIGINT NULL COMMENT ''参赛者ID'' AFTER contest_problem_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'team_id'
    ),
    'ALTER TABLE submissions ADD COLUMN team_id BIGINT NULL COMMENT ''团队ID（预留）'' AFTER participant_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'score'
    ),
    'ALTER TABLE submissions ADD COLUMN score INT NULL COMMENT ''得分（OI/部分分）'' AFTER status',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'code_length'
    ),
    'ALTER TABLE submissions ADD COLUMN code_length INT NULL COMMENT ''代码长度'' AFTER code',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'submit_time'
    ),
    'ALTER TABLE submissions ADD COLUMN submit_time DATETIME NULL COMMENT ''提交时间（冗余，便于查询）'' AFTER memory_used',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'judge_start_time'
    ),
    'ALTER TABLE submissions ADD COLUMN judge_start_time DATETIME NULL COMMENT ''判题开始时间'' AFTER submit_time',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'judge_end_time'
    ),
    'ALTER TABLE submissions ADD COLUMN judge_end_time DATETIME NULL COMMENT ''判题结束时间'' AFTER judge_start_time',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'is_contest_submission'
    ),
    'ALTER TABLE submissions ADD COLUMN is_contest_submission BOOLEAN NOT NULL DEFAULT FALSE COMMENT ''是否为比赛提交'' AFTER judge_end_time',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'is_frozen'
    ),
    'ALTER TABLE submissions ADD COLUMN is_frozen BOOLEAN NOT NULL DEFAULT FALSE COMMENT ''是否在封榜期间提交'' AFTER is_contest_submission',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'is_rejudged'
    ),
    'ALTER TABLE submissions ADD COLUMN is_rejudged BOOLEAN NOT NULL DEFAULT FALSE COMMENT ''是否为重判'' AFTER is_frozen',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'judge_message'
    ),
    'ALTER TABLE submissions ADD COLUMN judge_message TEXT NULL COMMENT ''判题信息'' AFTER is_rejudged',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 添加索引（使用条件判断）
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'submissions' AND INDEX_NAME = 'idx_contest_submit_time'
    ),
    'ALTER TABLE submissions ADD INDEX idx_contest_submit_time (contest_id, submit_time)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'submissions' AND INDEX_NAME = 'idx_participant'
    ),
    'ALTER TABLE submissions ADD INDEX idx_participant (participant_id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'submissions' AND INDEX_NAME = 'idx_frozen'
    ),
    'ALTER TABLE submissions ADD INDEX idx_frozen (contest_id, is_frozen)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 更新现有数据：设置 submit_time
UPDATE submissions SET submit_time = created_at WHERE submit_time IS NULL;
UPDATE submissions SET is_contest_submission = TRUE WHERE contest_id IS NOT NULL;

-- 5. 创建测试点结果表
CREATE TABLE submission_case_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    submission_id BIGINT NOT NULL COMMENT '提交ID',
    case_no INT NOT NULL COMMENT '测试点编号',
    subtask_no INT NULL COMMENT '子任务编号（OI）',
    status VARCHAR(40) NOT NULL COMMENT '测试点状态',
    score INT NULL COMMENT '测试点得分',
    max_score INT NULL COMMENT '测试点满分',
    time_used INT NULL COMMENT '运行时间（ms）',
    memory_used INT NULL COMMENT '内存使用（KB）',
    input_preview TEXT NULL COMMENT '输入预览',
    output_preview TEXT NULL COMMENT '输出预览',
    expected_preview TEXT NULL COMMENT '期望输出预览',
    judge_message TEXT NULL COMMENT '判题信息',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_submission (submission_id),
    KEY idx_case (submission_id, case_no)
) COMMENT '提交测试点结果表';

-- 6. 创建 ACM 总榜缓存表
CREATE TABLE contest_acm_rank_cache (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    contest_id BIGINT NOT NULL COMMENT '比赛ID',
    participant_id BIGINT NOT NULL COMMENT '参赛者ID',
    rank_no INT NOT NULL DEFAULT 0 COMMENT '排名',
    solved_count INT NOT NULL DEFAULT 0 COMMENT '通过题数',
    penalty_time INT NOT NULL DEFAULT 0 COMMENT '罚时（分钟）',
    submission_count INT NOT NULL DEFAULT 0 COMMENT '总提交次数',
    last_ac_time DATETIME NULL COMMENT '最后 AC 时间',
    last_submit_time DATETIME NULL COMMENT '最后提交时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_contest_participant (contest_id, participant_id),
    KEY idx_contest (contest_id),
    KEY idx_rank (contest_id, solved_count DESC, penalty_time ASC, last_ac_time ASC)
) COMMENT 'ACM 比赛总榜缓存';

-- 7. 创建 ACM 单题状态缓存表
CREATE TABLE contest_acm_rank_problems (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    contest_id BIGINT NOT NULL COMMENT '比赛ID',
    participant_id BIGINT NOT NULL COMMENT '参赛者ID',
    contest_problem_id BIGINT NOT NULL COMMENT '比赛题目ID',
    is_solved BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否已通过',
    wrong_attempts INT NOT NULL DEFAULT 0 COMMENT 'AC 前的错误次数',
    solve_time_minutes INT NULL COMMENT 'AC 时间（分钟，相对比赛开始）',
    first_ac_submission_id BIGINT NULL COMMENT '首次 AC 的提交ID',
    first_ac_time DATETIME NULL COMMENT '首次 AC 时间',
    last_submit_time DATETIME NULL COMMENT '最后提交时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_contest_participant_problem (contest_id, participant_id, contest_problem_id),
    KEY idx_contest (contest_id),
    KEY idx_participant (participant_id),
    KEY idx_problem (contest_problem_id)
) COMMENT 'ACM 比赛单题状态缓存';

-- 8. 创建 OI 总榜缓存表
CREATE TABLE contest_oi_rank_cache (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    contest_id BIGINT NOT NULL COMMENT '比赛ID',
    participant_id BIGINT NOT NULL COMMENT '参赛者ID',
    rank_no INT NOT NULL DEFAULT 0 COMMENT '排名',
    total_score INT NOT NULL DEFAULT 0 COMMENT '总分',
    solved_count INT NOT NULL DEFAULT 0 COMMENT '满分题数',
    submission_count INT NOT NULL DEFAULT 0 COMMENT '总提交次数',
    last_score_update_time DATETIME NULL COMMENT '最后得分更新时间',
    last_submit_time DATETIME NULL COMMENT '最后提交时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_contest_participant (contest_id, participant_id),
    KEY idx_contest (contest_id),
    KEY idx_rank (contest_id, total_score DESC, solved_count DESC, last_score_update_time ASC)
) COMMENT 'OI 比赛总榜缓存';

-- 9. 创建 OI 单题最高分缓存表
CREATE TABLE contest_oi_rank_problems (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    contest_id BIGINT NOT NULL COMMENT '比赛ID',
    participant_id BIGINT NOT NULL COMMENT '参赛者ID',
    contest_problem_id BIGINT NOT NULL COMMENT '比赛题目ID',
    best_score INT NOT NULL DEFAULT 0 COMMENT '最高分',
    full_score INT NOT NULL DEFAULT 100 COMMENT '满分',
    best_submission_id BIGINT NULL COMMENT '最高分提交ID',
    submission_count INT NOT NULL DEFAULT 0 COMMENT '该题提交次数',
    first_full_score_time DATETIME NULL COMMENT '首次满分时间',
    last_score_update_time DATETIME NULL COMMENT '最后得分更新时间',
    last_submit_time DATETIME NULL COMMENT '最后提交时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_contest_participant_problem (contest_id, participant_id, contest_problem_id),
    KEY idx_contest (contest_id),
    KEY idx_participant (participant_id),
    KEY idx_problem (contest_problem_id)
) COMMENT 'OI 比赛单题最高分缓存';

-- 10. 创建榜单快照表
CREATE TABLE contest_scoreboard_snapshots (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    contest_id BIGINT NOT NULL COMMENT '比赛ID',
    scoring_mode VARCHAR(16) NOT NULL COMMENT 'ACM or OI',
    snapshot_type VARCHAR(32) NOT NULL COMMENT 'FROZEN/FINAL/REALTIME/CUSTOM',
    data LONGTEXT NOT NULL COMMENT '快照数据（JSON）',
    generated_by BIGINT NULL COMMENT '生成者ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_contest_type (contest_id, snapshot_type),
    KEY idx_contest (contest_id)
) COMMENT '比赛榜单快照表';

-- 11. 从现有 contest_registrations 迁移数据到 contest_participants
INSERT INTO contest_participants (contest_id, user_id, identity_type, identity_id, nickname, registered_at)
SELECT
    cr.contest_id,
    cr.user_id,
    cr.identity_type,
    cr.identity_id,
    u.display_name,
    cr.registered_at
FROM contest_registrations cr
INNER JOIN users u ON cr.user_id = u.id
ON DUPLICATE KEY UPDATE
    identity_type = VALUES(identity_type),
    identity_id = VALUES(identity_id);

-- 12. 更新 submissions 表的 participant_id
UPDATE submissions s
INNER JOIN contest_participants cp ON s.contest_id = cp.contest_id AND s.user_id = cp.user_id
SET s.participant_id = cp.id
WHERE s.contest_id IS NOT NULL;

-- 13. 创建性能优化索引
SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'submissions' AND INDEX_NAME = 'idx_submission_judge_time'
    ),
    'CREATE INDEX idx_submission_judge_time ON submissions(judge_end_time)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'submissions' AND INDEX_NAME = 'idx_submission_status'
    ),
    'CREATE INDEX idx_submission_status ON submissions(contest_id, status)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'contest_participants' AND INDEX_NAME = 'idx_participant_identity'
    ),
    'CREATE INDEX idx_participant_identity ON contest_participants(contest_id, identity_type, identity_id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 14. 触发器已移至应用层处理
-- 应用层在插入 submission 时会自动设置：
-- - is_contest_submission
-- - submit_time
-- - participant_id

-- 完成迁移

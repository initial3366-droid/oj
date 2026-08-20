-- V79: IRT（项目反应理论）难度标定所需的存储列
--
-- 背景：problems.difficulty 是人工填写的整数，只用于列表筛选；
-- problems.ac_rate 是「通过数 / 提交数」的原始比值。用 ac_rate 当难度有一个统计上的硬伤——
-- 它把「题目有多难」和「谁来做了这道题」混在一起了（选择偏差）：
-- 一道只有强手敢碰的难题，通过率可能比一道人人都做的中等题还高。
--
-- IRT 的 Rasch 模型把这两者分开：P(学生 i 通过题 j) = sigmoid(theta_i - b_j)，
-- 从作答矩阵里联合估计学生能力 theta 与题目难度 b，二者在同一个 logit 尺度上可比。
--
-- 设计上刻意做成非破坏性：
--   * 不动 problems.difficulty，人工标注保持编辑权威，标定结果单独存列；
--   * 标定由管理端显式触发，不随判题自动写入，便于先离线看结果再决定是否采纳；
--   * 一并记录样本量与标定时间，样本太少的估计不可信，调用方需要据此判断。

SET @schema_name = DATABASE();

-- ============================================================
-- problems：题目难度参数 b、区分度、样本量、标定时间
-- ============================================================

-- b 参数，logit 尺度。取值大致在 [-4, 4]：0 表示能力中等的学生有五成把握通过，
-- 越大越难。DECIMAL(7,4) 足以容纳该范围并保留四位小数。
SET @exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'problems' AND COLUMN_NAME = 'irt_difficulty'
);
SET @sql = IF(@exists = 0,
    'ALTER TABLE problems ADD COLUMN irt_difficulty DECIMAL(7,4) NULL COMMENT ''IRT 难度参数 b（logit 尺度，越大越难）'' AFTER ac_rate',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 区分度：这里用点二列相关（通过与否 与 学生能力 的相关系数），取值 [-1, 1]。
-- 接近 0 说明强弱学生做这道题结果没差别，通常意味着题面有歧义或纯考模板；
-- 为负说明弱的学生反而更容易过，基本可以判定题目或数据有问题。
SET @exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'problems' AND COLUMN_NAME = 'irt_discrimination'
);
SET @sql = IF(@exists = 0,
    'ALTER TABLE problems ADD COLUMN irt_discrimination DECIMAL(7,4) NULL COMMENT ''区分度（点二列相关，越接近 0 越可能是坏题）'' AFTER irt_difficulty',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 参与估计的作答人数。样本越小估计越不可信，前端展示与筛选都应参考该值。
SET @exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'problems' AND COLUMN_NAME = 'irt_sample_size'
);
SET @sql = IF(@exists = 0,
    'ALTER TABLE problems ADD COLUMN irt_sample_size INT NULL COMMENT ''参与本次标定的作答人数'' AFTER irt_discrimination',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'problems' AND COLUMN_NAME = 'irt_calibrated_at'
);
SET @sql = IF(@exists = 0,
    'ALTER TABLE problems ADD COLUMN irt_calibrated_at DATETIME NULL COMMENT ''最近一次标定时间'' AFTER irt_sample_size',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 按难度排序取题（推荐、按难度浏览）会用到；只索引已标定的行
SET @exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'problems' AND INDEX_NAME = 'idx_problems_irt_difficulty'
);
SET @sql = IF(@exists = 0,
    'CREATE INDEX idx_problems_irt_difficulty ON problems (irt_difficulty)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- user_scores：学生能力参数 theta
-- ============================================================
-- 与 problems.irt_difficulty 同尺度可比：theta 等于 b 时通过概率为 0.5。
-- 注意不要与同表的 rating 列混淆——rating 预留给比赛评分（Elo/Glicko 一类），
-- 衡量的是竞赛表现；theta 衡量的是练习作答反映出的解题能力，两者口径不同。
SET @exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'user_scores' AND COLUMN_NAME = 'irt_ability'
);
SET @sql = IF(@exists = 0,
    'ALTER TABLE user_scores ADD COLUMN irt_ability DECIMAL(7,4) NULL COMMENT ''IRT 能力参数 theta（与题目 irt_difficulty 同尺度）'' AFTER rating',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

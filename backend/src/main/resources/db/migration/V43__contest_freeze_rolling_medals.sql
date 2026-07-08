SET @schema_name = DATABASE();

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contests'
          AND COLUMN_NAME = 'enable_rolling_scoreboard'
    ),
    'ALTER TABLE contests ADD COLUMN enable_rolling_scoreboard BOOLEAN NOT NULL DEFAULT FALSE COMMENT ''是否启用滚榜'' AFTER frozen',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contests'
          AND COLUMN_NAME = 'gold_ratio'
    ),
    'ALTER TABLE contests ADD COLUMN gold_ratio DECIMAL(5,2) NOT NULL DEFAULT 10.00 COMMENT ''金牌比例，百分比'' AFTER enable_rolling_scoreboard',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contests'
          AND COLUMN_NAME = 'silver_ratio'
    ),
    'ALTER TABLE contests ADD COLUMN silver_ratio DECIMAL(5,2) NOT NULL DEFAULT 20.00 COMMENT ''银牌比例，百分比'' AFTER gold_ratio',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
    NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = @schema_name
          AND TABLE_NAME = 'contests'
          AND COLUMN_NAME = 'bronze_ratio'
    ),
    'ALTER TABLE contests ADD COLUMN bronze_ratio DECIMAL(5,2) NOT NULL DEFAULT 30.00 COMMENT ''铜牌比例，百分比'' AFTER silver_ratio',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS contest_rolling_states (
    contest_id BIGINT NOT NULL PRIMARY KEY COMMENT '比赛ID',
    status VARCHAR(32) NOT NULL DEFAULT 'NOT_STARTED' COMMENT 'NOT_STARTED/ROLLING/FINISHED/PUBLISHED',
    current_step INT NOT NULL DEFAULT 0 COMMENT '当前已揭晓步数',
    total_steps INT NOT NULL DEFAULT 0 COMMENT '总步数',
    steps_json LONGTEXT NULL COMMENT '滚榜步骤JSON',
    started_by BIGINT NULL COMMENT '开始滚榜操作者',
    updated_by BIGINT NULL COMMENT '最后操作者',
    started_at DATETIME NULL COMMENT '开始时间',
    published_at DATETIME NULL COMMENT '发布最终榜时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_status (status),
    KEY idx_updated_at (updated_at)
) COMMENT '比赛滚榜状态表';

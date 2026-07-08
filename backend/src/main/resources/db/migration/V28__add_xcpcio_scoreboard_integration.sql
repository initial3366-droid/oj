-- XCPCIO / ICPC Contest API integration
CREATE TABLE IF NOT EXISTS contest_xcpcio_configs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    contest_id BIGINT NOT NULL COMMENT '比赛ID',
    enabled BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否启用 XCPCIO 榜单',
    mode VARCHAR(32) NOT NULL DEFAULT 'CLICS_EXPORT' COMMENT 'CLICS_EXPORT/XCPCIO_PUSH',
    xcpcio_contest_id VARCHAR(128) NULL COMMENT 'XCPCIO 比赛ID',
    token_encrypted TEXT NULL COMMENT 'XCPCIO token 加密值',
    board_url VARCHAR(512) NULL COMMENT 'XCPCIO 榜单访问地址',
    clics_access_token VARCHAR(128) NULL COMMENT 'CLICS 导出只读访问 token',
    sync_enabled BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否开启定时同步',
    sync_interval_seconds INT NOT NULL DEFAULT 5 COMMENT '同步间隔秒数',
    status VARCHAR(32) NOT NULL DEFAULT 'DISABLED' COMMENT 'DISABLED/PENDING/SYNCING/OK/FAILED',
    last_sync_at DATETIME NULL COMMENT '最后同步尝试时间',
    last_success_at DATETIME NULL COMMENT '最后成功同步时间',
    last_error TEXT NULL COMMENT '最后错误信息（已脱敏）',
    last_error_at DATETIME NULL COMMENT '最后错误时间',
    consecutive_failures INT NOT NULL DEFAULT 0 COMMENT '连续失败次数',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by BIGINT NULL COMMENT '最后更新人',
    UNIQUE KEY uk_contest_xcpcio_config_contest (contest_id),
    KEY idx_xcpcio_config_enabled (enabled, sync_enabled, status)
) COMMENT '比赛 XCPCIO 榜单配置';

CREATE TABLE IF NOT EXISTS contest_xcpcio_sync_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    contest_id BIGINT NOT NULL COMMENT '比赛ID',
    sync_type VARCHAR(32) NOT NULL COMMENT 'FULL/INCREMENTAL/MANUAL',
    status VARCHAR(32) NOT NULL COMMENT 'OK/FAILED/SKIPPED',
    started_at DATETIME NOT NULL,
    finished_at DATETIME NULL,
    pushed_submissions INT NOT NULL DEFAULT 0,
    http_status INT NULL,
    error_message TEXT NULL,
    KEY idx_xcpcio_sync_log_contest (contest_id, started_at)
) COMMENT '比赛 XCPCIO 同步日志';

CREATE TABLE IF NOT EXISTS contest_xcpcio_submission_sync (
    contest_id BIGINT NOT NULL,
    submission_id BIGINT NOT NULL,
    external_id VARCHAR(128) NULL,
    sync_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    synced_at DATETIME NULL,
    last_error TEXT NULL,
    PRIMARY KEY (contest_id, submission_id),
    KEY idx_xcpcio_submission_sync_status (contest_id, sync_status)
) COMMENT '比赛 XCPCIO 提交同步状态';

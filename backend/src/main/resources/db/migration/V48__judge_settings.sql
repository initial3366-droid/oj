-- V48: 判题配置 —— 判题开关 + 判题最大并发数（运行时可变，由管理后台维护）
-- 代码层（SystemSettingService）对未配置项有默认值兜底，此迁移仅用于初始化可见的默认行。

INSERT INTO system_settings (setting_key, setting_value, category, description, updated_at)
VALUES
('judge.enabled', 'true', 'judge', '判题总开关（关闭后无法提交记录和调试）', NOW()),
('judge.max_concurrent', '2', 'judge', '判题最大并发数（上限为线程池大小 qoj.judge.thread-pool-size）', NOW())
ON DUPLICATE KEY UPDATE setting_value = setting_value;
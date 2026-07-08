-- V54: P0 安全修复 —— 默认关闭不安全本地判题。
--
-- unsafe-local 会在后端主机上直接执行用户代码，仅允许开发/隔离环境手动启用。
-- 已部署实例如果沿用了旧默认值，本迁移会切换到 Docker 判题并关闭沙箱调试。

INSERT INTO system_settings (setting_key, setting_value, category, description, updated_at)
VALUES
('judge.mode', 'docker', 'judge', '判题模式：domjudge、docker、unsafe-local', NOW()),
('judge.contest_mode', 'docker', 'judge', '比赛判题模式：domjudge、docker、unsafe-local', NOW()),
('judge.enable_unsafe_local_judge', 'false', 'judge', '是否允许不安全本地判题', NOW()),
('judge.enable_sandbox', 'false', 'judge', '是否允许沙箱调试运行', NOW())
ON DUPLICATE KEY UPDATE setting_value = setting_value;

UPDATE system_settings
SET setting_value = 'docker',
    updated_at = NOW()
WHERE setting_key IN ('judge.mode', 'judge.contest_mode')
  AND LOWER(setting_value) = 'unsafe-local';

UPDATE system_settings
SET setting_value = 'false',
    updated_at = NOW()
WHERE setting_key = 'judge.enable_unsafe_local_judge'
  AND LOWER(setting_value) <> 'false';

UPDATE system_settings
SET setting_value = 'false',
    updated_at = NOW()
WHERE setting_key = 'judge.enable_sandbox'
  AND LOWER(setting_value) <> 'false';

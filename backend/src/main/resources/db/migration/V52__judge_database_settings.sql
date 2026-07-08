-- V52: 判题接入配置迁移到 system_settings，由后台“判题配置”统一维护。

INSERT INTO system_settings (setting_key, setting_value, category, description, updated_at)
VALUES
('judge.mode', 'docker', 'judge', '判题模式：domjudge、docker、unsafe-local', NOW()),
('judge.enable_unsafe_local_judge', 'false', 'judge', '是否允许不安全本地判题', NOW()),
('judge.enable_sandbox', 'false', 'judge', '是否允许沙箱调试运行', NOW()),
('judge.thread_pool_size', '2', 'judge', '判题线程池大小', NOW()),
('judge.queue_batch_size', '2', 'judge', '每轮从队列拉取的最大任务数', NOW()),
('judge.poll_interval_ms', '1000', 'judge', '判题队列轮询间隔（毫秒）', NOW()),
('judge.domjudge_base_url', 'http://127.0.0.1:8081', 'judge', 'DOMjudge API 地址', NOW()),
('judge.domjudge_api_key', '', 'judge', 'DOMjudge API Key', NOW()),
('judge.domjudge_contest_id', '', 'judge', 'DOMjudge 默认比赛 ID', NOW()),
('judge.domjudge_poll_interval_ms', '2000', 'judge', 'DOMjudge 结果轮询间隔（毫秒）', NOW())
ON DUPLICATE KEY UPDATE setting_value = setting_value;

UPDATE system_settings
SET description = '判题最大并发数（上限为 judge.thread_pool_size）'
WHERE setting_key = 'judge.max_concurrent';

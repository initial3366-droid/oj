INSERT INTO system_settings (setting_key, setting_value, category, description, updated_at)
VALUES
('system.agent_config', '{"enabled":false,"baseUrl":"","apiKey":"","model":"","timeoutMs":30000,"maxCodeChars":12000}', 'system', 'AI助手配置', NOW()),
('system.oss_config', '{"enabled":false,"endpoint":"","bucket":"","region":"","accessKeyId":"","accessKeySecret":"","publicBaseUrl":"","dir":"avatars/","maxSizeMb":5}', 'system', 'OSS配置', NOW())
ON DUPLICATE KEY UPDATE setting_key = setting_key;

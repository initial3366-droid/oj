-- 后台路径前缀设置
INSERT INTO system_settings (setting_key, setting_value, category, description, updated_at)
VALUES ('admin.path_prefix', 'admin', 'admin', '后台管理路径前缀（修改后需重启后端并重新构建前端）', NOW())
ON DUPLICATE KEY UPDATE setting_value = setting_value;

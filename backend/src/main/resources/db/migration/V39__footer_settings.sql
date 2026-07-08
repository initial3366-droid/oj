INSERT INTO system_settings (setting_key, setting_value, category, description)
VALUES
    ('frontend.footer_text', 'QOJ 在线评测系统', 'frontend', '底部文案'),
    ('frontend.icp_number', '', 'frontend', '备案号')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

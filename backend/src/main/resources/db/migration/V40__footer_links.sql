INSERT INTO system_settings (setting_key, setting_value, category, description)
VALUES
    ('frontend.footer_link1_text', '', 'frontend', '底部链接1文字'),
    ('frontend.footer_link1_url', '', 'frontend', '底部链接1地址'),
    ('frontend.footer_link2_text', '', 'frontend', '底部链接2文字'),
    ('frontend.footer_link2_url', '', 'frontend', '底部链接2地址')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

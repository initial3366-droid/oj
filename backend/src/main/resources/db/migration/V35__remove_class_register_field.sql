UPDATE system_settings
SET setting_value = JSON_REMOVE(setting_value, '$.className')
WHERE setting_key = 'register.fields_config'
  AND JSON_VALID(setting_value)
  AND JSON_CONTAINS_PATH(setting_value, 'one', '$.className');

INSERT INTO system_settings (setting_key, setting_value, category, description)
SELECT
    'register.fields_config',
    '{"studentNo":{"enabled":true,"required":true},"email":{"enabled":true,"required":false}}',
    'register',
    '注册字段配置'
WHERE NOT EXISTS (
    SELECT 1 FROM system_settings WHERE setting_key = 'register.fields_config'
);

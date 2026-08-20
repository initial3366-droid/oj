-- V86: 移除 C# 语言支持（QOJ 不再支持 C# 判题）
-- 从 system.code_templates 的 JSON 配置中删除 csharp 模板。

UPDATE system_settings
SET setting_value = JSON_REMOVE(setting_value, '$.csharp')
WHERE setting_key = 'system.code_templates'
  AND JSON_CONTAINS_PATH(setting_value, 'one', '$.csharp');

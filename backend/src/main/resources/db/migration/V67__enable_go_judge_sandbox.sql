-- V54 disabled sandbox debugging because it executed untrusted code through
-- the retired local/Docker judge. Debug runs now use the authenticated,
-- resource-limited go-judge service, so new and upgraded installations can
-- safely expose the existing feature while retaining the administrator switch.
INSERT INTO system_settings (
    setting_key,
    setting_value,
    category,
    description,
    updated_at,
    updated_by
)
VALUES (
    'judge.enable_sandbox',
    'true',
    'judge',
    '是否允许通过 go-judge 进行沙箱调试运行',
    NOW(),
    'flyway-v67'
)
ON DUPLICATE KEY UPDATE
    -- V54-created rows have no operator. Preserve an explicit administrator
    -- override while upgrading the retired local-judge default.
    setting_value = IF(updated_by IS NULL OR updated_by = 'flyway-v67', VALUES(setting_value), setting_value),
    description = VALUES(description),
    updated_at = IF(updated_by IS NULL OR updated_by = 'flyway-v67', VALUES(updated_at), updated_at),
    updated_by = IF(updated_by IS NULL OR updated_by = 'flyway-v67', VALUES(updated_by), updated_by);

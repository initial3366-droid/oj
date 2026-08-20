UPDATE system_settings
SET description = '判题任务（GO_JUDGE/CCPCOJ）失联重新领取时间（分钟）',
    updated_at = NOW()
WHERE setting_key = 'judge.ccpcoj_stale_task_minutes';

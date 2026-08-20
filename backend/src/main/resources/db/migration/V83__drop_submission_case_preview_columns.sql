-- 移除提交测试点结果中的输入/输出/期望预览列。
-- 管理端提交详情不再展示预览；后端已停止写入/读取这些字段（JudgeCallbackService 不再赋值，SubmissionCaseVO/SubmissionCaseResult 已移除对应字段）。
ALTER TABLE submission_case_results
    DROP COLUMN input_preview,
    DROP COLUMN output_preview,
    DROP COLUMN expected_preview;

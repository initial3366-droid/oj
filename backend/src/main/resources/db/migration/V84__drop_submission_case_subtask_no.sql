-- 移除提交测试点结果中的子任务编号列。
-- 子任务编号没有任何写入来源：gojudge 链路（JudgeCaseResult）与 CCPCOJ 链路（updateSolution 不携带 caseResults）均不产生 subtaskNo，该列始终为 NULL，前端"子任务"列从未显示。
ALTER TABLE submission_case_results
    DROP COLUMN subtask_no;

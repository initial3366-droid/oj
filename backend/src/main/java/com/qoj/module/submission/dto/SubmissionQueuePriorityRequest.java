package com.qoj.module.submission.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * 提交队列Priority请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record SubmissionQueuePriorityRequest(
    @NotNull(message = "优先级不能为空")
    @Min(value = 0, message = "优先级不能小于0")
    @Max(value = 1000, message = "优先级不能大于1000")
    Integer priority
) {
}

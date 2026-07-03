package com.qoj.module.submission.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record SubmissionQueuePriorityRequest(
    @NotNull(message = "优先级不能为空")
    @Min(value = 0, message = "优先级不能小于0")
    @Max(value = 1000, message = "优先级不能大于1000")
    Integer priority
) {
}

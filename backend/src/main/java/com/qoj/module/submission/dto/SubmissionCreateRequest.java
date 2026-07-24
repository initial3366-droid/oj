package com.qoj.module.submission.dto;

import com.qoj.common.enums.IdentityType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 提交Create请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record SubmissionCreateRequest(
    @NotNull Long problemId,
    Long contestId,
    Long practiceId,
    @NotBlank @Size(max = 65536) String code,
    @NotBlank @Size(max = 64) String language,
    IdentityType identityType,
    Long identityId
) {
}

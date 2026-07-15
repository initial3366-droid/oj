package com.qoj.module.practice.dto;

import com.qoj.common.enums.AudienceType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * 练习Create请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record PracticeCreateRequest(
    @NotBlank String title,
    String description,
    AudienceType audience,
    Long audienceId,
    String password,
    @NotEmpty List<Long> problemIds,
    String accessScope,
    Long majorId
) {
}

package com.qoj.module.problem.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 题目DraftBasic请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ProblemDraftBasicRequest(
    @NotBlank @Size(max = 200) String title,
    @NotNull @Min(100) @Max(60000) Integer timeLimit,
    @NotNull @Min(16) @Max(1024) Integer memoryLimit,
    @NotBlank String statement,
    String inputFormat,
    String outputFormat,
    List<String> tags,
    @Min(value = 1, message = "难度不能小于1") @Max(value = 5, message = "难度不能大于5") Integer difficulty,
    Long folderId,
    Boolean isPublic,
    @Valid List<ProblemSampleCaseRequest> samples
) {
}

package com.qoj.module.problem.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 题目Update请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ProblemUpdateRequest(
    @NotBlank(message = "请输入题目名称") @Size(max = 200, message = "题目名称不能超过200个字符") String title,
    @NotNull(message = "请输入时间限制") @Min(value = 100, message = "时间限制不能小于100ms")
    @Max(value = 60000, message = "时间限制不能超过60000ms") Integer timeLimit,
    @NotNull(message = "请输入内存限制") @Min(value = 16, message = "内存限制不能小于16MB")
    @Max(value = 1024, message = "内存限制不能超过1024MB") Integer memoryLimit,
    @NotBlank(message = "请输入题目描述") String statement,
    String inputFormat,
    String outputFormat,
    @Min(value = 1, message = "难度不能小于1") @Max(value = 5, message = "难度不能大于5") Integer difficulty,
    List<String> tags,
    Long folderId,
    Boolean isPublic,
    List<ProblemSampleCaseRequest> samples,
    String sampleCases
) {
}

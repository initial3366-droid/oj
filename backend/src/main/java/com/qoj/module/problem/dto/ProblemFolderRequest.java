package com.qoj.module.problem.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 题目文件夹请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ProblemFolderRequest(
    @NotBlank @Size(max = 100) String name,
    @Size(max = 500) String description,
    Integer displayOrder,
    String accessScope,
    Long majorId
) {}

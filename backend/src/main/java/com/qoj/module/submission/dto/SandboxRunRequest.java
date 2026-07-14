package com.qoj.module.submission.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 沙箱Run请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record SandboxRunRequest(
    @NotBlank @Size(max = 65536) String code,
    @NotBlank @Size(max = 64) String language,
    @Size(max = 65536) String input
) {
}

package com.qoj.module.practice.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 练习Unlock请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record PracticeUnlockRequest(
    @NotBlank(message = "练习密码不能为空") String password
) {
}

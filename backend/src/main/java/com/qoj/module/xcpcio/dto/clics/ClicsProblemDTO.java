package com.qoj.module.xcpcio.dto.clics;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Clics题目请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ClicsProblemDTO(
    String id,
    Integer ordinal,
    String label,
    String name,
    @JsonProperty("time_limit") Double timeLimit,
    @JsonProperty("color") String color
) {
}

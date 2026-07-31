package com.qoj.module.xcpcio.dto.clics;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Clics分数请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ClicsScoreDTO(
    @JsonProperty("num_solved") Integer numSolved,
    @JsonProperty("total_time") Integer totalTime
) {
}

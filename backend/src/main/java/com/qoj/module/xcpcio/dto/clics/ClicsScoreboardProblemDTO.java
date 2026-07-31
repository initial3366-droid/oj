package com.qoj.module.xcpcio.dto.clics;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Clics榜单题目请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ClicsScoreboardProblemDTO(
    @JsonProperty("problem_id") String problemId,
    @JsonProperty("num_judged") Integer numJudged,
    @JsonProperty("num_pending") Integer numPending,
    Boolean solved,
    Integer time
) {
}

package com.qoj.module.xcpcio.dto.clics;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

/**
 * Clics提交请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ClicsSubmissionDTO(
    String id,
    @JsonProperty("language_id") String languageId,
    @JsonProperty("problem_id") String problemId,
    @JsonProperty("team_id") String teamId,
    OffsetDateTime time,
    @JsonProperty("contest_time") String contestTime
) {
}

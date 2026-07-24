package com.qoj.module.xcpcio.dto.clics;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

/**
 * Clics比赛请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ClicsContestDTO(
    String id,
    String name,
    @JsonProperty("formal_name") String formalName,
    @JsonProperty("start_time") OffsetDateTime startTime,
    String duration,
    @JsonProperty("scoreboard_freeze_duration") String scoreboardFreezeDuration,
    @JsonProperty("penalty_time") String penaltyTime
) {
}

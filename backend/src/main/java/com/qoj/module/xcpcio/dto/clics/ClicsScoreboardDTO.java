package com.qoj.module.xcpcio.dto.clics;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Clics榜单请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ClicsScoreboardDTO(
    @JsonProperty("event_id") String eventId,
    OffsetDateTime time,
    @JsonProperty("contest_time") String contestTime,
    ClicsStateDTO state,
    List<ClicsScoreboardRowDTO> rows
) {
}

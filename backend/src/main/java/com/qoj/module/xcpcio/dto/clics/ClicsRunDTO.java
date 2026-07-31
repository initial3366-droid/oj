package com.qoj.module.xcpcio.dto.clics;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

/**
 * ClicsRun请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ClicsRunDTO(
    String id,
    @JsonProperty("judgement_id") String judgementId,
    Integer ordinal,
    @JsonProperty("judgement_type_id") String judgementTypeId,
    OffsetDateTime time,
    @JsonProperty("contest_time") String contestTime,
    @JsonProperty("run_time") Double runTime
) {
}

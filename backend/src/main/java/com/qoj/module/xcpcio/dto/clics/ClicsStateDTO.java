package com.qoj.module.xcpcio.dto.clics;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

/**
 * ClicsState请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ClicsStateDTO(
    OffsetDateTime started,
    OffsetDateTime frozen,
    OffsetDateTime ended,
    OffsetDateTime thawed,
    OffsetDateTime finalized,
    @JsonProperty("end_of_updates") OffsetDateTime endOfUpdates
) {
}

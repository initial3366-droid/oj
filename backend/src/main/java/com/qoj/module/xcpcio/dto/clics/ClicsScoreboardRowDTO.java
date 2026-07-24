package com.qoj.module.xcpcio.dto.clics;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * Clics榜单Row请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ClicsScoreboardRowDTO(
    Integer rank,
    @JsonProperty("team_id") String teamId,
    ClicsScoreDTO score,
    List<ClicsScoreboardProblemDTO> problems
) {
}

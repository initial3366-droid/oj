package com.qoj.module.xcpcio.dto.clics;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * ClicsTeam请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ClicsTeamDTO(
    String id,
    String name,
    @JsonProperty("display_name") String displayName,
    @JsonProperty("group_ids") List<String> groupIds
) {
}

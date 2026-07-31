package com.qoj.module.xcpcio.dto.clics;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * ClicsOrganization请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ClicsOrganizationDTO(
    String id,
    String name,
    @JsonProperty("formal_name") String formalName,
    String country
) {
}

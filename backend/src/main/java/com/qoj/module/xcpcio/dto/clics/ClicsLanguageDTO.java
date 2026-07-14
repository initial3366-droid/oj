package com.qoj.module.xcpcio.dto.clics;

/**
 * ClicsLanguage请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record ClicsLanguageDTO(
    String id,
    String name
) {
}

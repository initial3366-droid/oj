package com.qoj.module.home.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * CarouselSlide请求数据模型。用于承接接口输入并通过声明式约束完成基础参数校验。
 */
public record CarouselSlideRequest(
    @NotBlank String title,
    @NotBlank String imageUrl,
    String cta,
    String targetUrl,
    @NotNull Integer displayOrder,
    Boolean enabled
) {
}

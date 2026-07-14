package com.qoj.module.home.vo;

/**
 * CarouselSlide响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record CarouselSlideVO(
    Long id,
    String title,
    String imageUrl,
    String cta,
    String targetUrl,
    Integer displayOrder,
    Boolean enabled
) {
}

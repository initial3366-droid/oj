package com.qoj.module.home.vo;

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

package com.qoj.module.home.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CarouselSlideRequest(
    @NotBlank String title,
    @NotBlank String imageUrl,
    String cta,
    String targetUrl,
    @NotNull Integer displayOrder,
    Boolean enabled
) {
}

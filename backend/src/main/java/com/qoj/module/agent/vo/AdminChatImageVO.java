package com.qoj.module.agent.vo;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** Only the owned image ID is trusted on input; all other metadata comes from storage. */
public record AdminChatImageVO(
    @NotBlank @Pattern(regexp = "[A-Za-z0-9-]{1,80}") String id,
    String name, String mimeType, Long size, Integer width, Integer height
) {}

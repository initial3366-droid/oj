package com.qoj.module.agent.vo;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record AdminChatFileVO(
    @NotBlank @Pattern(regexp = "[A-Za-z0-9-]{1,80}") String id,
    String name, Long size, Integer entryCount
) {}

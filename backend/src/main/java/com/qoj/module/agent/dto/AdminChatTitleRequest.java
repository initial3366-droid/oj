package com.qoj.module.agent.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminChatTitleRequest(@NotBlank @Size(max = 80) String title) {}

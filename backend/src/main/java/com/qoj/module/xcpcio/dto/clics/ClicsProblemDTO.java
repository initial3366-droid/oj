package com.qoj.module.xcpcio.dto.clics;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ClicsProblemDTO(
    String id,
    Integer ordinal,
    String label,
    String name,
    @JsonProperty("time_limit") Double timeLimit,
    @JsonProperty("color") String color
) {
}

package com.qoj.module.xcpcio.dto.clics;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ClicsScoreDTO(
    @JsonProperty("num_solved") Integer numSolved,
    @JsonProperty("total_time") Integer totalTime
) {
}

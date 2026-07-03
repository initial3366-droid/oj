package com.qoj.module.xcpcio.dto.clics;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

public record ClicsContestDTO(
    String id,
    String name,
    @JsonProperty("formal_name") String formalName,
    @JsonProperty("start_time") OffsetDateTime startTime,
    String duration,
    @JsonProperty("scoreboard_freeze_duration") String scoreboardFreezeDuration,
    @JsonProperty("penalty_time") String penaltyTime
) {
}

package com.qoj.module.xcpcio.dto.clics;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

public record ClicsSubmissionDTO(
    String id,
    @JsonProperty("language_id") String languageId,
    @JsonProperty("problem_id") String problemId,
    @JsonProperty("team_id") String teamId,
    OffsetDateTime time,
    @JsonProperty("contest_time") String contestTime
) {
}

package com.qoj.module.xcpcio.dto.clics;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ClicsScoreboardProblemDTO(
    @JsonProperty("problem_id") String problemId,
    @JsonProperty("num_judged") Integer numJudged,
    @JsonProperty("num_pending") Integer numPending,
    Boolean solved,
    Integer time
) {
}

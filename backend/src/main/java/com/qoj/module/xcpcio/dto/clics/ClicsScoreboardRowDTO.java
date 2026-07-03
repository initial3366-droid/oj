package com.qoj.module.xcpcio.dto.clics;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record ClicsScoreboardRowDTO(
    Integer rank,
    @JsonProperty("team_id") String teamId,
    ClicsScoreDTO score,
    List<ClicsScoreboardProblemDTO> problems
) {
}

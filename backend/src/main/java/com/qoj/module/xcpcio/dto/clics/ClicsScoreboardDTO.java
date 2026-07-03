package com.qoj.module.xcpcio.dto.clics;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;
import java.util.List;

public record ClicsScoreboardDTO(
    @JsonProperty("event_id") String eventId,
    OffsetDateTime time,
    @JsonProperty("contest_time") String contestTime,
    ClicsStateDTO state,
    List<ClicsScoreboardRowDTO> rows
) {
}

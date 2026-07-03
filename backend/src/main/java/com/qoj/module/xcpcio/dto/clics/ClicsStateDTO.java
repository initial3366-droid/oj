package com.qoj.module.xcpcio.dto.clics;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

public record ClicsStateDTO(
    OffsetDateTime started,
    OffsetDateTime frozen,
    OffsetDateTime ended,
    OffsetDateTime thawed,
    OffsetDateTime finalized,
    @JsonProperty("end_of_updates") OffsetDateTime endOfUpdates
) {
}

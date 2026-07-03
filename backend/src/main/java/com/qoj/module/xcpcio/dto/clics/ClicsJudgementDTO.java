package com.qoj.module.xcpcio.dto.clics;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

public record ClicsJudgementDTO(
    String id,
    @JsonProperty("submission_id") String submissionId,
    @JsonProperty("judgement_type_id") String judgementTypeId,
    @JsonProperty("start_time") OffsetDateTime startTime,
    @JsonProperty("start_contest_time") String startContestTime,
    @JsonProperty("end_time") OffsetDateTime endTime,
    @JsonProperty("end_contest_time") String endContestTime,
    @JsonProperty("max_run_time") Double maxRunTime
) {
}

package com.qoj.module.xcpcio.dto.clics;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record ClicsTeamDTO(
    String id,
    String name,
    @JsonProperty("display_name") String displayName,
    @JsonProperty("group_ids") List<String> groupIds
) {
}

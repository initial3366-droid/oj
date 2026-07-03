package com.qoj.module.xcpcio.dto.clics;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ClicsOrganizationDTO(
    String id,
    String name,
    @JsonProperty("formal_name") String formalName,
    String country
) {
}

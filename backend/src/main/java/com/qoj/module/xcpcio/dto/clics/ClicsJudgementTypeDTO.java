package com.qoj.module.xcpcio.dto.clics;

public record ClicsJudgementTypeDTO(
    String id,
    String name,
    Boolean penalty,
    Boolean solved
) {
}

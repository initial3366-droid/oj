package com.qoj.module.contest.vo;

public record ContestRegistrationOptionVO(
    String identityType,
    Long identityId,
    String name,
    Boolean available,
    String disabledReason,
    Boolean starAvailable
) {
}

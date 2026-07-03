package com.qoj.module.contest.dto;

import com.qoj.common.enums.IdentityType;

public record ContestRegisterRequest(
    IdentityType identityType,
    Long identityId,
    Boolean starred,
    String password
) {
}

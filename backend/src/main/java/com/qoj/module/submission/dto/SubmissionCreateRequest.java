package com.qoj.module.submission.dto;

import com.qoj.common.enums.IdentityType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SubmissionCreateRequest(
    @NotNull Long problemId,
    Long contestId,
    Long practiceId,
    @NotBlank @Size(max = 65536) String code,
    @NotBlank String language,
    IdentityType identityType,
    Long identityId
) {
}

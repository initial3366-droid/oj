package com.qoj.module.submission.vo;

import java.time.LocalDateTime;

public record SandboxRunVO(
    Long id,
    String output,
    String status,
    LocalDateTime runAt
) {
}

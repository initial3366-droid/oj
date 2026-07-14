package com.qoj.module.submission.vo;

import java.time.LocalDateTime;

/**
 * 沙箱Run响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record SandboxRunVO(
    Long id,
    String output,
    String status,
    LocalDateTime runAt
) {
}

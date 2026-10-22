package com.qoj.module.contest.vo;

import java.time.LocalDateTime;

public record ContestMessageVO(long id, Long participantId, String kind, String authorName,
    String content, LocalDateTime createdAt) {}

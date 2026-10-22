package com.qoj.module.contest.vo;

import java.util.List;

public record ContestMessageFeedVO(String contestTitle, long userId, long readThroughId,
    List<ContestMessageVO> messages, boolean hasMore) {}

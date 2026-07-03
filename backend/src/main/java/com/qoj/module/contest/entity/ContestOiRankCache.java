package com.qoj.module.contest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("contest_oi_rank_cache")
public class ContestOiRankCache {
    @TableId(type = IdType.AUTO)
    public Long id;
    public Long contestId;
    public Long participantId;
    public Integer rankNo;
    public Integer totalScore;
    public Integer solvedCount;
    public Integer submissionCount;
    public LocalDateTime lastScoreUpdateTime;
    public LocalDateTime lastSubmitTime;
    public LocalDateTime updatedAt;

    public Long getContestId() { return contestId; }
    public Long getParticipantId() { return participantId; }
}

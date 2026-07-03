package com.qoj.module.contest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("contest_oi_rank_problems")
public class ContestOiRankProblem {
    @TableId(type = IdType.AUTO)
    public Long id;
    public Long contestId;
    public Long participantId;
    public Long contestProblemId;
    public Integer bestScore;
    public Integer fullScore;
    public Long bestSubmissionId;
    public Integer submissionCount;
    public LocalDateTime firstFullScoreTime;
    public LocalDateTime lastScoreUpdateTime;
    public LocalDateTime lastSubmitTime;
    public LocalDateTime updatedAt;

    public Long getContestId() { return contestId; }
    public Long getParticipantId() { return participantId; }
    public Long getContestProblemId() { return contestProblemId; }
}

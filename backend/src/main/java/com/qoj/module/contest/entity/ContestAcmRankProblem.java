package com.qoj.module.contest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("contest_acm_rank_problems")
public class ContestAcmRankProblem {
    @TableId(type = IdType.AUTO)
    public Long id;
    public Long contestId;
    public Long participantId;
    public Long contestProblemId;
    public Boolean isSolved;
    public Integer wrongAttempts;
    public Integer solveTimeMinutes;
    public Long firstAcSubmissionId;
    public LocalDateTime firstAcTime;
    public LocalDateTime lastSubmitTime;
    public LocalDateTime updatedAt;

    public Long getContestId() { return contestId; }
    public Long getParticipantId() { return participantId; }
    public Long getContestProblemId() { return contestProblemId; }
}

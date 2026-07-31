package com.qoj.module.contest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 比赛Oi排名Cache持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
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

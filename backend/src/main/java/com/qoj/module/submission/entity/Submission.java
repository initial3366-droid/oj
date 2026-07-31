package com.qoj.module.submission.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 提交持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
@TableName("submissions")
public class Submission {
    @TableId(type = IdType.AUTO)
    public Long id;
    public Long userId;
    public Long problemId;
    public Long contestId;
    public Long contestProblemId;
    public Long participantId;
    public Long teamId;
    public Long practiceId;
    public Long practicePublicationId;
    public String code;
    public Integer codeLength;
    public String language;
    public String status;
    public Integer score;
    public Integer timeUsed;
    public Integer memoryUsed;
    public LocalDateTime submitTime;
    public LocalDateTime judgeStartTime;
    public LocalDateTime judgeEndTime;
    public Boolean isContestSubmission;
    public Boolean isFrozen;
    public Boolean isRejudged;
    public String judgeMessage;
    public String identityType;
    public Long identityId;
    public String judgeServer;
    public String judgeBackend;
    public String judgeWorkerId;
    public Integer priority;
    public Integer retryCount;
    public String errorMessage;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;

    public Long getContestId() { return contestId; }
    public Long getParticipantId() { return participantId; }
    public LocalDateTime getSubmitTime() { return submitTime; }
}

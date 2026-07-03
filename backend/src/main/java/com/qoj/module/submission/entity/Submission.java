package com.qoj.module.submission.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

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
    public String domjudgeSubmissionId;
    public String judgeServer;
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

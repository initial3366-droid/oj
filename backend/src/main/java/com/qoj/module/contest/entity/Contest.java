package com.qoj.module.contest.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@TableName("contests")
public class Contest {
    @TableId(type = IdType.AUTO)
    public Long id;
    public String title;
    public String description;
    public Integer durationMinutes;
    public LocalDateTime startTime;
    public LocalDateTime endTime;
    public String type;
    public String scoringMode;
    public LocalDateTime freezeTime;
    public Integer penaltyMinutes;
    public Boolean countCeAsPenalty;
    public Long ownerId;
    public String ownerAccountType;
    public String audience;
    public Long audienceId;
    public Boolean frozen;
    public Boolean enableRollingScoreboard;
    public BigDecimal goldRatio;
    public BigDecimal silverRatio;
    public BigDecimal bronzeRatio;
    public Boolean allowFullscreen;
    public Boolean antiCheatEnabled;
    public Integer maxSwitches;
    public Boolean allowAfterEndSubmit;
    public Boolean allowAfterEndViewProblem;
    public Boolean allowAfterEndViewCode;
    public Boolean publicScoreboardEnabled;
    public Boolean showClassOnScoreboard;
    public Boolean allowStarRegistration;
    public Boolean allowViewAllSubmissions;
    public String registrationType;
    public String registrationPassword;
    public String status;
    public Integer registrationCount;
    public Integer participantCount;
    public Boolean isDeleted;
    public LocalDateTime deletedAt;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}

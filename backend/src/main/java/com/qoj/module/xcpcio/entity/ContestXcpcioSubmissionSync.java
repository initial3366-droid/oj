package com.qoj.module.xcpcio.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("contest_xcpcio_submission_sync")
public class ContestXcpcioSubmissionSync {
    @TableId
    public Long contestId;
    public Long submissionId;
    public String externalId;
    public String syncStatus;
    public LocalDateTime syncedAt;
    public String lastError;
}

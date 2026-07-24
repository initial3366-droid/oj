package com.qoj.module.xcpcio.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 比赛Xcpcio提交Sync持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
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

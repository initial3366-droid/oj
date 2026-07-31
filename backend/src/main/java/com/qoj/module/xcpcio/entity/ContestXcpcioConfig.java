package com.qoj.module.xcpcio.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 比赛Xcpcio持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
@TableName("contest_xcpcio_configs")
public class ContestXcpcioConfig {
    @TableId(type = IdType.AUTO)
    public Long id;
    public Long contestId;
    public Boolean enabled;
    public String mode;
    public String xcpcioContestId;
    public String tokenEncrypted;
    public String boardUrl;
    public String clicsAccessToken;
    public Boolean syncEnabled;
    public Integer syncIntervalSeconds;
    public String status;
    public LocalDateTime lastSyncAt;
    public LocalDateTime lastSuccessAt;
    public String lastError;
    public LocalDateTime lastErrorAt;
    public Integer consecutiveFailures;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
    public Long updatedBy;
}

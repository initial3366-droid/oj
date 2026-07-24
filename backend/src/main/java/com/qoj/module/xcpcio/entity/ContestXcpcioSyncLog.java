package com.qoj.module.xcpcio.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 比赛XcpcioSyncLog持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
@TableName("contest_xcpcio_sync_logs")
public class ContestXcpcioSyncLog {
    @TableId(type = IdType.AUTO)
    public Long id;
    public Long contestId;
    public String syncType;
    public String status;
    public LocalDateTime startedAt;
    public LocalDateTime finishedAt;
    public Integer pushedSubmissions;
    public Integer httpStatus;
    public String errorMessage;
}

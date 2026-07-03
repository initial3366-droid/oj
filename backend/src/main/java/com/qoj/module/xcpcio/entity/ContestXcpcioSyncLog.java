package com.qoj.module.xcpcio.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

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

package com.qoj.module.submission.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("sandbox_runs")
public class SandboxRun {
    @TableId(type = IdType.AUTO)
    public Long id;
    public Long userId;
    public String code;
    public String language;
    public String input;
    public String output;
    public String status;
    public LocalDateTime runAt;
}

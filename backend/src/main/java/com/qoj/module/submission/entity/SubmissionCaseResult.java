package com.qoj.module.submission.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 提交测试点结果持久化实体。字段与数据库记录对应，用于在数据访问层和业务层之间传递状态。
 */
@TableName("submission_case_results")
public class SubmissionCaseResult {
    @TableId(type = IdType.AUTO)
    public Long id;

    public Long submissionId;
    public Integer caseNo;
    public Integer subtaskNo;

    public String status;
    public Integer score;
    public Integer maxScore;

    public Integer timeUsed; // ms
    public Integer memoryUsed; // KB

    public String inputPreview;
    public String outputPreview;
    public String expectedPreview;
    public String judgeMessage;

    public LocalDateTime createdAt;
}

package com.qoj.module.problem.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 题目文件夹与题目的关联记录。
 */
@TableName("problem_folder_items")
public class ProblemFolderItem {
    public Long folderId;
    public Long problemId;
    public Integer displayOrder;
    public String relationType;
    public String addedByAccountType;
    public Long addedById;
    public LocalDateTime createdAt;
}

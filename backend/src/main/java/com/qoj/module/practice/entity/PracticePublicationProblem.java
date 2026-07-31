package com.qoj.module.practice.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("practice_publication_problems")
public class PracticePublicationProblem {
    public Long publicationId;
    public Long problemId;
    public Integer displayOrder;
    public Integer score;
    public String visibility;
    public LocalDateTime createdAt;
}

package com.qoj.module.practice.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("practice_publication_classes")
public class PracticePublicationClass {
    public Long publicationId;
    public Long classId;
    public LocalDateTime createdAt;
}

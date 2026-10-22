package com.qoj.module.course.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("course_classes")
public class CourseClass {
    public Long courseId;
    public Long classId;
    public LocalDateTime createdAt;
}

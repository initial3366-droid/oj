package com.qoj.module.course.vo;

import java.time.LocalDateTime;

public record CoursePracticeVO(Long id, String title, String description, Integer displayOrder,
    int problemCount, int solvedCount, boolean hasPassword, LocalDateTime startTime, LocalDateTime endTime) {}

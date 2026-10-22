package com.qoj.module.course.vo;

import java.util.List;

public record CourseReportVO(Long courseId, int practiceCount, List<StudentProgress> students) {
    public record StudentProgress(Long userId, String displayName, String studentNo,
        int submissionCount, int solvedCount, int completedPractices, Long classId, String className) {}
}

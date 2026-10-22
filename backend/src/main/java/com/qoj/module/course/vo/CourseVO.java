package com.qoj.module.course.vo;

import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.AutomapConstructor;

public record CourseVO(Long id, String title, String description, String term,
    String ownerAccountType, Long ownerId, String teacherName, Long classId, String className,
    String status, int studentCount, int practiceCount, LocalDateTime createdAt, LocalDateTime updatedAt,
    List<Long> classIds, List<CourseClassVO> classes) {
    @AutomapConstructor
    public CourseVO(Long id, String title, String description, String term,
        String ownerAccountType, Long ownerId, String teacherName, Long classId, String className,
        String status, int studentCount, int practiceCount, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this(id, title, description, term, ownerAccountType, ownerId, teacherName, classId, className,
            status, studentCount, practiceCount, createdAt, updatedAt, List.of(), List.of());
    }

    public CourseVO withClasses(List<CourseClassVO> values) {
        return new CourseVO(id, title, description, term, ownerAccountType, ownerId, teacherName,
            values.isEmpty() ? null : values.get(0).id(),
            values.isEmpty() ? null : values.get(0).name(), status, studentCount, practiceCount,
            createdAt, updatedAt, values.stream().map(CourseClassVO::id).toList(), values);
    }
}

package com.qoj.module.problem.vo;

import java.time.LocalDateTime;
import java.util.List;

public record ProblemFolderVO(
    Long id,
    String name,
    String description,
    Integer displayOrder,
    int problemCount,
    List<FolderProblemVO> problems,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    public record FolderProblemVO(
        Long id,
        String title,
        Integer difficulty,
        Integer timeLimit,
        Integer memoryLimit,
        Long testCaseCount
    ) {}
}

package com.qoj.module.problem.vo;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 题目文件夹响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record ProblemFolderVO(
    Long id,
    String name,
    String description,
    Integer displayOrder,
    int problemCount,
    List<FolderProblemVO> problems,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    String ownerAccountType,
    Long ownerId,
    String accessScope,
    Long majorId,
    String majorName,
    Boolean owner,
    Boolean canEdit
) {
    /**
     * 文件夹题目响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
     */
    public record FolderProblemVO(
        Long id,
        String title,
        Integer difficulty,
        Integer timeLimit,
        Integer memoryLimit,
        Long testCaseCount
    ) {}
}

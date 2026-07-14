package com.qoj.module.practice.vo;

import com.qoj.module.problem.vo.ProblemVO;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 练习响应视图模型。仅暴露调用方需要的字段，避免直接返回持久化实体。
 */
public record PracticeVO(
    Long id,
    String title,
    String description,
    String audience,
    Long audienceId,
    Boolean hasPassword,
    Long ownerId,
    List<ProblemVO> problems,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
}

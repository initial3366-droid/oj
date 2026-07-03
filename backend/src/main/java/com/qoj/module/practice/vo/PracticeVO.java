package com.qoj.module.practice.vo;

import com.qoj.module.problem.vo.ProblemVO;
import java.time.LocalDateTime;
import java.util.List;

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

package com.qoj.module.practice.vo;

import com.qoj.module.problem.vo.ProblemVO;
import java.time.LocalDateTime;
import java.util.List;

public record PracticePublicationVO(
    Long id,
    Long sourcePracticeId,
    String title,
    String description,
    String audience,
    Long audienceId,
    Boolean hasPassword,
    Long ownerId,
    List<ProblemVO> problems,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    String publisherAccountType,
    String status,
    String studentAccessMode,
    List<Long> classIds,
    List<PublicationProblemVO> publicationProblems
) {
    public record PublicationProblemVO(
        Long problemId,
        Integer displayOrder,
        Integer score,
        String visibility,
        String title
    ) {
    }
}

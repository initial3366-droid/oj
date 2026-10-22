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
    List<PublicationProblemVO> publicationProblems,
    Long courseId,
    Integer displayOrder,
    LocalDateTime startTime,
    LocalDateTime endTime
) {
    public PracticePublicationVO(Long id, Long sourcePracticeId, String title, String description,
        String audience, Long audienceId, Boolean hasPassword, Long ownerId, List<ProblemVO> problems,
        LocalDateTime createdAt, LocalDateTime updatedAt, String publisherAccountType, String status,
        String studentAccessMode, List<Long> classIds, List<PublicationProblemVO> publicationProblems) {
        this(id, sourcePracticeId, title, description, audience, audienceId, hasPassword, ownerId,
            problems, createdAt, updatedAt, publisherAccountType, status, studentAccessMode,
            classIds, publicationProblems, null, null, null, null);
    }

    public record PublicationProblemVO(
        Long problemId,
        Integer displayOrder,
        Integer score,
        String visibility,
        String title
    ) {
    }
}

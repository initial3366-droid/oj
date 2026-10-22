package com.qoj.module.problem.solution.vo;

import java.util.List;

public record ProblemSolutionLevelVO(
    int height,
    int currentLevel,
    int maxViewedLevel,
    String content,
    long acceptedCount,
    Integer acceptedLevel,
    List<Long> levelAcceptedCounts
) {}

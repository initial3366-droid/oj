package com.qoj.module.problem.solution.dto;

import java.util.List;

public record SaveProblemSolutionsRequest(int height, List<Level> levels) {
    public record Level(int level, String content, String source) {}
}

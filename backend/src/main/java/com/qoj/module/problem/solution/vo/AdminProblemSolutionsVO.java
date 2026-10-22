package com.qoj.module.problem.solution.vo;

import java.util.List;

public record AdminProblemSolutionsVO(int height, List<Node> levels) {
    public record Node(long id, Long parentId, int level, String content, String source) {}
}

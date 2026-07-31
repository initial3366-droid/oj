package com.qoj.module.problem.vo;

import java.util.List;

/**
 * 文件夹组题候选题目。
 */
public record ProblemFolderCandidateVO(
    Long id,
    String title,
    Integer difficulty,
    Integer timeLimit,
    Integer memoryLimit,
    String accessScope,
    String majorName,
    List<String> folderNames
) {
}

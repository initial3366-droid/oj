package com.qoj.module.problem.dto;

import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * 文件夹组题保存请求，数组顺序即题目展示顺序。
 */
public record ProblemFolderProblemsRequest(
    @NotNull List<@NotNull Long> problemIds
) {
}

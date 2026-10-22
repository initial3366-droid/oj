package com.qoj.module.problem.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ProblemBatchRequest(
    @NotEmpty(message = "请选择题目")
    @Size(max = 100, message = "每次最多操作100道题目")
    List<@NotNull @Positive Long> ids
) {
}

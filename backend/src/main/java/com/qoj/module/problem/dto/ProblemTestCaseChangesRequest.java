package com.qoj.module.problem.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.List;

/** An atomic set of explicit changes; omitted cases are never rewritten. */
public record ProblemTestCaseChangesRequest(
    @NotNull List<@NotNull @Valid Change> changes,
    @NotNull List<@NotNull @Positive Long> deletedIds
) {
    public record Change(Long id, @NotNull @Positive Integer caseNo,
                         @NotNull String input, String output, String publicInput) {
    }
}

package com.qoj.module.problem.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Verifies that teacher-facing problem draft validation messages are localized. */
class ProblemDraftRequestValidationTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void basicInformationReportsChineseFieldMessages() {
        ProblemDraftBasicRequest request = new ProblemDraftBasicRequest(
            "",
            99,
            15,
            "",
            null,
            null,
            null,
            List.of(),
            0,
            null,
            true,
            "ALL",
            null,
            "PUBLISHED",
            List.of(new ProblemSampleCaseRequest("", "", null))
        );

        Set<String> messages = validator.validate(request).stream()
            .map(violation -> violation.getMessage())
            .collect(Collectors.toSet());

        assertTrue(messages.contains("题目名称不能为空"));
        assertTrue(messages.contains("时间限制不能小于100ms"));
        assertTrue(messages.contains("内存限制不能小于16MB"));
        assertTrue(messages.contains("题目描述不能为空"));
        assertTrue(messages.contains("难度不能小于1"));
        assertTrue(messages.contains("样例输入数据不能为空"));
        assertTrue(messages.contains("样例输出数据不能为空"));
    }

    @Test
    void testCasesAllowBlankExpectedOutputUntilProblemTypeIsKnown() {
        ProblemDraftTestCasesRequest request = new ProblemDraftTestCasesRequest(
            List.of(new ProblemTestCaseRequest(1, "", ""))
        );

        Set<String> messages = validator.validate(request).stream()
            .map(violation -> violation.getMessage())
            .collect(Collectors.toSet());

        // Output requirements depend on whether the problem uses an SPJ checker.
        assertFalse(messages.contains("测试点输入数据不能为空"));
        assertFalse(messages.contains("测试点输出数据不能为空"));
    }

    @Test
    void testCaseWithOnlyOutputPassesValidation() {
        ProblemDraftTestCasesRequest request = new ProblemDraftTestCasesRequest(
            List.of(new ProblemTestCaseRequest(1, "", "42"))
        );

        Set<String> messages = validator.validate(request).stream()
            .map(violation -> violation.getMessage())
            .collect(Collectors.toSet());

        assertTrue(messages.isEmpty());
    }

    @Test
    void emptyTestCasesReportChineseFieldMessage() {
        ProblemDraftTestCasesRequest request = new ProblemDraftTestCasesRequest(List.of());

        Set<String> messages = validator.validate(request).stream()
            .map(violation -> violation.getMessage())
            .collect(Collectors.toSet());

        assertTrue(messages.contains("请至少添加一个测试点"));
    }
}

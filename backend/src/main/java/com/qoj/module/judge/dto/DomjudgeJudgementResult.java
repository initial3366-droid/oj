package com.qoj.module.judge.dto;

public record DomjudgeJudgementResult(
    String judgementTypeId,
    Integer timeUsed,
    Integer memoryUsed,
    boolean finalResult
) {
}

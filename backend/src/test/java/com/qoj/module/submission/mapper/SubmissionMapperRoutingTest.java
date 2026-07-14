package com.qoj.module.submission.mapper;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.util.Arrays;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Locks the SQL-side ownership boundary required to prevent double judging. */
class SubmissionMapperRoutingTest {

    /**
     * 封装go判题SelectionAndClaimRequireGo判题Snapshot相关逻辑。可能调用外部判题或网关服务。
     */
    @Test
    void goJudgeSelectionAndClaimRequireGoJudgeSnapshot() {
        assertBackend(selectSql("selectWaitingForEmbeddedJudge"), "GO_JUDGE");
        assertBackend(updateSql("atomicClaim"), "GO_JUDGE");
        assertBackend(updateSql("restoreRejectedEmbeddedClaim"), "GO_JUDGE");
    }

    /**
     * 封装ccpcojSelectionClaimAndAuthorizationRequireCcpcojSnapshot相关逻辑。可能调用外部判题或网关服务。
     */
    @Test
    void ccpcojSelectionClaimAndAuthorizationRequireCcpcojSnapshot() {
        assertBackend(selectSql("selectWaitingForCcpcoj"), "CCPCOJ");
        assertBackend(updateSql("claimForCcpcoj"), "CCPCOJ");
        assertBackend(selectSql("countActiveCcpcojClaims"), "CCPCOJ");
    }

    /**
     * 封装assertBackend相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private void assertBackend(String sql, String backend) {
        String normalized = sql.replaceAll("\\s+", " ").toUpperCase();
        assertTrue(normalized.contains("JUDGE_BACKEND"));
        assertTrue(normalized.contains("'" + backend + "'"));
        assertFalse(sql.contains("${"), "routing SQL must never interpolate worker input");
    }

    /**
     * 封装selectSql相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private String selectSql(String methodName) {
        return annotationSql(methodName, Select.class);
    }

    /**
     * 更新Sql。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private String updateSql(String methodName) {
        return annotationSql(methodName, Update.class);
    }

    /**
     * 封装annotationSql相关逻辑。从持久化层读取数据。
     */
    private <T extends Annotation> String annotationSql(String methodName, Class<T> annotationType) {
        Method method = Arrays.stream(SubmissionMapper.class.getDeclaredMethods())
            .filter(candidate -> candidate.getName().equals(methodName))
            .findFirst()
            .orElseThrow();
        Annotation annotation = method.getAnnotation(annotationType);
        if (annotation instanceof Select select) {
            return String.join(" ", select.value());
        }
        if (annotation instanceof Update update) {
            return String.join(" ", update.value());
        }
        /**
         * 封装IllegalStateException相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        throw new IllegalStateException("Missing SQL annotation on " + methodName);
    }
}

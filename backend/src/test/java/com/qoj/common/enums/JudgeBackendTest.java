package com.qoj.common.enums;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * 判题Backend测试类。验证关键业务规则、异常边界及回归场景。
 */
class JudgeBackendTest {

    /**
     * 封装missing比赛ChoiceDefaultsToGo判题相关逻辑。可能调用外部判题或网关服务。
     */
    @Test
    void missingContestChoiceDefaultsToGoJudge() {
        assertEquals(JudgeBackend.GO_JUDGE, JudgeBackend.contestDefault(null));
        assertEquals(JudgeBackend.GO_JUDGE, JudgeBackend.fromStored(null, JudgeBackend.GO_JUDGE));
    }

    /**
     * 封装invalidPersisted路由FailsClosed相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Test
    void invalidPersistedRouteFailsClosed() {
        assertThrows(
            IllegalStateException.class,
            () -> JudgeBackend.fromStored("attacker-controlled", JudgeBackend.GO_JUDGE)
        );
    }
}

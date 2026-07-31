package com.qoj.module.judge.controller;

import com.qoj.module.judge.service.CcpcojJudgeGatewayService;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Ccpcoj判题Controller测试类。验证关键业务规则、异常边界及回归场景。
 */
@ExtendWith(MockitoExtension.class)
class CcpcojJudgeControllerTest {
    /**
     * 封装production登录AlwaysIssuesSecureCookie相关逻辑。可能调用外部判题或网关服务。
     */
    @Mock private CcpcojJudgeGatewayService gatewayService;
    @Mock private Environment environment;

    @Test
    void productionLoginAlwaysIssuesSecureCookie() {
        CcpcojJudgeController controller = new CcpcojJudgeController(gatewayService, environment);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("10.0.0.8");
        when(gatewayService.login("judger", "strong-password", "10.0.0.8"))
            .thenReturn(CcpcojJudgeGatewayService.LoginResult.success("session-id"));
        when(gatewayService.sessionTtl()).thenReturn(Duration.ofMinutes(30));
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(true);

        ResponseEntity<String> response = controller.login("judger", "strong-password", request);

        assertEquals(200, response.getStatusCode().value());
        String cookie = response.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        assertTrue(cookie != null && cookie.contains("Secure"));
        assertTrue(cookie.contains("HttpOnly"));
        assertTrue(cookie.contains("SameSite=Strict"));
    }

    /**
     * 封装malformedNumericParameterReturnsBad请求相关逻辑。可能调用外部判题或网关服务。
     */
    @Test
    void malformedNumericParameterReturnsBadRequest() {
        CcpcojJudgeController controller = new CcpcojJudgeController(gatewayService, environment);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addParameter("checkout", "1");
        request.addParameter("sid", "not-a-number");
        when(gatewayService.authenticated("session-id")).thenReturn(true);

        ResponseEntity<?> response = controller.judge(request, "session-id");

        assertEquals(400, response.getStatusCode().value());
    }

    /**
     * 封装sourceReadPasses会话ForOwnershipValidation相关逻辑。可能调用外部判题或网关服务。
     */
    @Test
    void sourceReadPassesSessionForOwnershipValidation() {
        CcpcojJudgeController controller = new CcpcojJudgeController(gatewayService, environment);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addParameter("getsolution", "1");
        request.addParameter("sid", "9");
        when(gatewayService.authenticated("session-id")).thenReturn(true);
        when(gatewayService.sourceCode(9L, "session-id")).thenReturn("code\n");

        ResponseEntity<?> response = controller.judge(request, "session-id");

        assertEquals(200, response.getStatusCode().value());
        /**
         * 校验前置条件。可能调用外部判题或网关服务。
         */
        verify(gatewayService).sourceCode(9L, "session-id");
    }

    /**
     * 封装登录RateLimitReturnsRetryAfter相关逻辑。可能调用外部判题或网关服务。
     */
    @Test
    void loginRateLimitReturnsRetryAfter() {
        CcpcojJudgeController controller = new CcpcojJudgeController(gatewayService, environment);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("10.0.0.8");
        when(gatewayService.login("judger", "strong-password", "10.0.0.8"))
            .thenReturn(CcpcojJudgeGatewayService.LoginResult.rateLimited());

        ResponseEntity<String> response = controller.login("judger", "strong-password", request);

        assertEquals(429, response.getStatusCode().value());
        assertEquals("60", response.getHeaders().getFirst(HttpHeaders.RETRY_AFTER));
    }
}

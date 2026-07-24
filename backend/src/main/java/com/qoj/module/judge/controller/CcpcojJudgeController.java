package com.qoj.module.judge.controller;

import com.qoj.module.judge.service.CcpcojJudgeGatewayService;
import com.qoj.module.judge.service.CcpcojJudgeGatewayService.LoginResult;
import com.qoj.module.judge.service.CcpcojJudgeGatewayService.LoginStatus;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * HTTP compatibility endpoint consumed by CCPCOJ judge workers.
 *
 * <p>This protocol intentionally remains separate from user/admin JWT auth.
 */
@RestController
@RequestMapping("/ojtool/judge")
public class CcpcojJudgeController {
    private static final String NO_STORE = "no-store";
    private static final String RETRY_AFTER_SECONDS = "60";

    private final CcpcojJudgeGatewayService gatewayService;
    private final Environment environment;

    /**
     * 构造 Ccpcoj判题Controller 实例并保存其必要依赖或初始状态。可能调用外部判题或网关服务。
     */
    public CcpcojJudgeController(CcpcojJudgeGatewayService gatewayService, Environment environment) {
        this.gatewayService = gatewayService;
        this.environment = environment;
    }

    /**
     * 封装登录相关逻辑。不满足业务约束时直接抛出明确异常；可能调用外部判题或网关服务。
     */
    @PostMapping(value = "/judge_login", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> login(
        @RequestParam("user_id") String username,
        @RequestParam String password,
        HttpServletRequest request
    ) {
        final LoginResult result;
        try {
            result = gatewayService.login(username, password, request.getRemoteAddr());
        } catch (IllegalArgumentException ex) {
            /**
             * 封装bad请求相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return badRequest(ex.getMessage());
        }
        if (result.status() == LoginStatus.RATE_LIMITED) {
            return ResponseEntity.status(429)
                .header(HttpHeaders.CACHE_CONTROL, NO_STORE)
                .header(HttpHeaders.RETRY_AFTER, RETRY_AFTER_SECONDS)
                .contentType(MediaType.TEXT_PLAIN)
                .body("Too Many Attempts");
        }
        if (result.status() != LoginStatus.SUCCESS || result.sessionId() == null) {
            return ResponseEntity.status(401)
                .header(HttpHeaders.CACHE_CONTROL, NO_STORE)
                .contentType(MediaType.TEXT_PLAIN)
                .body("Password Error!");
        }

        ResponseCookie cookie = ResponseCookie.from(CcpcojJudgeGatewayService.SESSION_COOKIE, result.sessionId())
            .httpOnly(true)
            .secure(isProduction() || isHttps(request))
            .sameSite("Strict")
            .path("/ojtool/judge")
            .maxAge(gatewayService.sessionTtl())
            .build();
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, cookie.toString())
            .header(HttpHeaders.CACHE_CONTROL, NO_STORE)
            .contentType(MediaType.TEXT_PLAIN)
            .body("Success");
    }

    @PostMapping(value = "/judge")
    public ResponseEntity<?> judge(
        HttpServletRequest request,
        @CookieValue(value = CcpcojJudgeGatewayService.SESSION_COOKIE, required = false) String sessionId
    ) {
        if (!gatewayService.authenticated(sessionId)) {
            /**
             * 封装text相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return text("0");
        }
        try {
            /**
             * 处理判题请求。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return handleJudgeRequest(request, sessionId);
        } catch (IllegalArgumentException ex) {
            /**
             * 封装bad请求相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return badRequest(ex.getMessage());
        }
    }

    private ResponseEntity<?> handleJudgeRequest(HttpServletRequest request, String sessionId) {
        if (has(request, "checklogin")) {
            /**
             * 封装text相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return text("1");
        }
        if (has(request, "getpending")) {
            String languageSet = optionalText(request, "oj_lang_set", 128);
            /**
             * 封装text相关逻辑。可能调用外部判题或网关服务。
             */
            return text(gatewayService.pending(
                intParam(request, "max_running", 1, 1, 100), languageSet, sessionId));
        }
        if (has(request, "checkout")) {
            /**
             * 封装text相关逻辑。可能调用外部判题或网关服务。
             */
            return text(gatewayService.checkout(longParam(request, "sid"), sessionId) ? "1" : "0");
        }
        if (has(request, "getsolutioninfo")) {
            /**
             * 封装text相关逻辑。可能调用外部判题或网关服务。
             */
            return text(gatewayService.solutionInfo(longParam(request, "sid"), sessionId));
        }
        if (has(request, "getsolution")) {
            /**
             * 封装text相关逻辑。可能调用外部判题或网关服务。
             */
            return text(gatewayService.sourceCode(longParam(request, "sid"), sessionId));
        }
        if (has(request, "getcustominput")) {
            /**
             * 封装text相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return text("");
        }
        if (has(request, "getprobleminfo")) {
            /**
             * 封装text相关逻辑。可能调用外部判题或网关服务。
             */
            return text(gatewayService.problemInfo(longParam(request, "pid"), sessionId));
        }
        if (has(request, "gettestdatalist")) {
            /**
             * 封装text相关逻辑。可能调用外部判题或网关服务。
             */
            return text(gatewayService.testDataList(longParam(request, "pid"), sessionId));
        }
        if (has(request, "gettestdata")) {
            String filename = requiredText(request, "filename", 128);
            byte[] data = gatewayService.testData(filename, sessionId);
            return data == null
                ? ResponseEntity.notFound().header(HttpHeaders.CACHE_CONTROL, NO_STORE).build()
                : ResponseEntity.ok()
                    .header(HttpHeaders.CACHE_CONTROL, NO_STORE)
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .body(data);
        }
        if (has(request, "update_solution")) {
            gatewayService.updateSolution(
                longParam(request, "sid"),
                intParam(request, "result", 14, 2, 14),
                intParam(request, "time", 0, 0, Integer.MAX_VALUE),
                intParam(request, "memory", 0, 0, Integer.MAX_VALUE),
                doubleParam(request, "pass_rate", 0.0, 0.0, 1.0),
                gatewayService.workerId(sessionId)
            );
            /**
             * 封装text相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return text("update_solution ok");
        }
        if (has(request, "addceinfo")) {
            gatewayService.addJudgeMessage(
                longParam(request, "sid"),
                requiredText(request, "ceinfo", CcpcojJudgeGatewayService.MAX_JUDGE_MESSAGE_LENGTH),
                gatewayService.workerId(sessionId)
            );
            /**
             * 封装text相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return text("addceinfo ok\n");
        }
        if (has(request, "addreinfo")) {
            gatewayService.addJudgeMessage(
                longParam(request, "sid"),
                requiredText(request, "reinfo", CcpcojJudgeGatewayService.MAX_JUDGE_MESSAGE_LENGTH),
                gatewayService.workerId(sessionId)
            );
            /**
             * 封装text相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return text("addreinfo ok\n");
        }
        if (has(request, "updateuser") || has(request, "updateproblem")) {
            /**
             * 封装text相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return text("ok");
        }
        /**
         * 封装text相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return text("");
    }

    private ResponseEntity<String> text(String body) {
        return ResponseEntity.ok()
            .header(HttpHeaders.CACHE_CONTROL, NO_STORE)
            .contentType(MediaType.TEXT_PLAIN)
            .body(body);
    }

    private ResponseEntity<String> badRequest(String message) {
        return ResponseEntity.badRequest()
            .header(HttpHeaders.CACHE_CONTROL, NO_STORE)
            .contentType(MediaType.TEXT_PLAIN)
            .body(message == null || message.isBlank() ? "Bad Request" : message);
    }

    private boolean has(HttpServletRequest request, String name) {
        return request.getParameter(name) != null;
    }

    private long longParam(HttpServletRequest request, String name) {
        String value = requiredText(request, name, 20);
        try {
            long parsed = Long.parseLong(value);
            if (parsed <= 0 || parsed > Integer.MAX_VALUE) {
                /**
                 * 封装IllegalArgumentException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new IllegalArgumentException(name + " 参数超出范围");
            }
            return parsed;
        } catch (NumberFormatException ex) {
            /**
             * 封装IllegalArgumentException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new IllegalArgumentException(name + " 参数格式错误", ex);
        }
    }

    private int intParam(HttpServletRequest request, String name, int defaultValue, int min, int max) {
        String value = request.getParameter(name);
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        try {
            int parsed = Integer.parseInt(value);
            if (parsed < min || parsed > max) {
                /**
                 * 封装IllegalArgumentException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new IllegalArgumentException(name + " 参数超出范围");
            }
            return parsed;
        } catch (NumberFormatException ex) {
            /**
             * 封装IllegalArgumentException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new IllegalArgumentException(name + " 参数格式错误", ex);
        }
    }

    private double doubleParam(
        HttpServletRequest request,
        String name,
        double defaultValue,
        double min,
        double max
    ) {
        String value = request.getParameter(name);
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        try {
            double parsed = Double.parseDouble(value);
            if (!Double.isFinite(parsed) || parsed < min || parsed > max) {
                /**
                 * 封装IllegalArgumentException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new IllegalArgumentException(name + " 参数超出范围");
            }
            return parsed;
        } catch (NumberFormatException ex) {
            /**
             * 封装IllegalArgumentException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new IllegalArgumentException(name + " 参数格式错误", ex);
        }
    }

    private String requiredText(HttpServletRequest request, String name, int maxLength) {
        String value = request.getParameter(name);
        if (value == null || value.isBlank() || value.length() > maxLength) {
            /**
             * 封装IllegalArgumentException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new IllegalArgumentException(name + " 参数格式错误");
        }
        return value;
    }

    private String optionalText(HttpServletRequest request, String name, int maxLength) {
        String value = request.getParameter(name);
        if (value != null && value.length() > maxLength) {
            /**
             * 封装IllegalArgumentException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new IllegalArgumentException(name + " 参数格式错误");
        }
        return value;
    }

    private boolean isProduction() {
        return environment.acceptsProfiles(Profiles.of("prod", "production"));
    }

    /**
     * Production cookies are always Secure. In other profiles, trusted reverse
     * proxies can communicate the original HTTPS scheme through standard headers.
     */
    private boolean isHttps(HttpServletRequest request) {
        if (request.isSecure()) {
            return true;
        }
        String forwardedProto = request.getHeader("X-Forwarded-Proto");
        if (forwardedProto != null
            && "https".equalsIgnoreCase(forwardedProto.split(",", 2)[0].trim())) {
            return true;
        }
        String forwarded = request.getHeader("Forwarded");
        if (forwarded == null) {
            return false;
        }
        for (String parameter : forwarded.split("[;,]")) {
            String normalized = parameter.trim().toLowerCase(Locale.ROOT);
            if ("proto=https".equals(normalized) || "proto=\"https\"".equals(normalized)) {
                return true;
            }
        }
        return false;
    }
}

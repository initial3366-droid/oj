package com.qoj.module.judge.controller;

import com.qoj.module.judge.service.CcpcojJudgeGatewayService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/ojtool/judge")
public class CcpcojJudgeController {
    private final CcpcojJudgeGatewayService gatewayService;

    public CcpcojJudgeController(CcpcojJudgeGatewayService gatewayService) {
        this.gatewayService = gatewayService;
    }

    @PostMapping(value = "/judge_login", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> login(
        @RequestParam("user_id") String username,
        @RequestParam String password,
        HttpServletRequest request
    ) {
        String sessionId = gatewayService.login(username, password);
        if (sessionId == null) {
            return ResponseEntity.status(401).body("Password Error!");
        }
        ResponseCookie cookie = ResponseCookie.from(CcpcojJudgeGatewayService.SESSION_COOKIE, sessionId)
            .httpOnly(true)
            .secure(request.isSecure())
            .sameSite("Strict")
            .path("/ojtool/judge")
            .maxAge(gatewayService.sessionTtl())
            .build();
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, cookie.toString())
            .contentType(MediaType.TEXT_PLAIN)
            .body("Success");
    }

    @PostMapping(value = "/judge")
    public ResponseEntity<?> judge(
        HttpServletRequest request,
        @CookieValue(value = CcpcojJudgeGatewayService.SESSION_COOKIE, required = false) String sessionId
    ) {
        if (!gatewayService.authenticated(sessionId)) {
            return text("0");
        }
        if (has(request, "checklogin")) {
            return text("1");
        }
        if (has(request, "getpending")) {
            return text(gatewayService.pending(
                intParam(request, "max_running", 1), request.getParameter("oj_lang_set"), sessionId));
        }
        if (has(request, "checkout")) {
            return text(gatewayService.checkout(
                longParam(request, "sid"), gatewayService.workerId(sessionId)) ? "1" : "0");
        }
        if (has(request, "getsolutioninfo")) {
            return text(gatewayService.solutionInfo(longParam(request, "sid")));
        }
        if (has(request, "getsolution")) {
            return text(gatewayService.sourceCode(longParam(request, "sid")));
        }
        if (has(request, "getcustominput")) {
            return text("");
        }
        if (has(request, "getprobleminfo")) {
            return text(gatewayService.problemInfo(longParam(request, "pid")));
        }
        if (has(request, "gettestdatalist")) {
            return text(gatewayService.testDataList(longParam(request, "pid")));
        }
        if (has(request, "gettestdata")) {
            byte[] data = gatewayService.testData(request.getParameter("filename"));
            return data == null
                ? ResponseEntity.notFound().build()
                : ResponseEntity.ok().contentType(MediaType.APPLICATION_OCTET_STREAM).body(data);
        }
        if (has(request, "update_solution")) {
            gatewayService.updateSolution(
                longParam(request, "sid"),
                intParam(request, "result", 14),
                intParam(request, "time", 0),
                intParam(request, "memory", 0),
                doubleParam(request, "pass_rate", 0.0),
                gatewayService.workerId(sessionId)
            );
            return text("update_solution ok");
        }
        if (has(request, "addceinfo")) {
            gatewayService.addJudgeMessage(
                longParam(request, "sid"), request.getParameter("ceinfo"), gatewayService.workerId(sessionId));
            return text("addceinfo ok\n");
        }
        if (has(request, "addreinfo")) {
            gatewayService.addJudgeMessage(
                longParam(request, "sid"), request.getParameter("reinfo"), gatewayService.workerId(sessionId));
            return text("addreinfo ok\n");
        }
        if (has(request, "updateuser") || has(request, "updateproblem")) {
            return text("ok");
        }
        return text("");
    }

    private ResponseEntity<String> text(String body) {
        return ResponseEntity.ok().contentType(MediaType.TEXT_PLAIN).body(body);
    }

    private boolean has(HttpServletRequest request, String name) {
        return request.getParameter(name) != null;
    }

    private long longParam(HttpServletRequest request, String name) {
        return Long.parseLong(request.getParameter(name));
    }

    private int intParam(HttpServletRequest request, String name, int defaultValue) {
        String value = request.getParameter(name);
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return Integer.parseInt(value);
    }

    private double doubleParam(HttpServletRequest request, String name, double defaultValue) {
        String value = request.getParameter(name);
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return Double.parseDouble(value);
    }
}

package com.qoj.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * SpaForward接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@Controller
public class SpaForwardController {

    @Value("${admin.path-prefix:admin}")
    private String adminPathPrefix;

    @GetMapping({
        "/",
        "/problems",
        "/problems/**",
        "/practice",
        "/practice/**",
        "/contests",
        "/contests/**",
        "/leaderboard",
        "/submission-queue",
        "/users/**",
        "/user-center",
        "/login",
        "/register",
        "/profile",
        "/semi-test"
    })
    public String forwardToIndex() {
        return "forward:/index.html";
    }

    @GetMapping({"/{path:^(?!ws)[a-z]+}", "/{path:^(?!ws)[a-z]+}/**"})
    public String forwardAdminPaths() {
        return "forward:/index.html";
    }
}

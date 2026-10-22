package com.qoj.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * SpaForward接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@Controller
public class SpaForwardController {

    @GetMapping({
        "/",
        "/about",
        "/courses",
        "/courses/**",
        "/redirect/**",
        "/problems",
        "/problems/**",
        "/practice",
        "/practice/**",
        "/contests",
        "/contests/**",
        "/leaderboard",
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

    // API 路径必须交给 RestController；否则旧接口或未匹配接口会被 SPA fallback 返回 index.html。
    @GetMapping({"/${admin.path-prefix:admin}", "/${admin.path-prefix:admin}/**", "/teacher", "/teacher/**"})
    public String forwardAdminPaths() {
        return "forward:/index.html";
    }
}

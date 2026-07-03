package com.qoj.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

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

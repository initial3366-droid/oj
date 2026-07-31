package com.qoj.module.user.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.user.service.UserPublicService;
import com.qoj.module.user.vo.PublicUserProfileVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 用户Public接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/v1/users")
public class UserPublicController {
    private final UserPublicService userPublicService;

    /**
     * 构造 用户PublicController 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public UserPublicController(UserPublicService userPublicService) {
        this.userPublicService = userPublicService;
    }

    /**
     * 封装资料相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/{id}")
    public ApiResponse<PublicUserProfileVO> profile(@PathVariable long id) {
        return ApiResponse.ok(userPublicService.profile(id));
    }
}

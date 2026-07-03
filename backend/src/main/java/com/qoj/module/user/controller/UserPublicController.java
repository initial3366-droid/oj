package com.qoj.module.user.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.user.service.UserPublicService;
import com.qoj.module.user.vo.PublicUserProfileVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
public class UserPublicController {
    private final UserPublicService userPublicService;

    public UserPublicController(UserPublicService userPublicService) {
        this.userPublicService = userPublicService;
    }

    @GetMapping("/{id}")
    public ApiResponse<PublicUserProfileVO> profile(@PathVariable long id) {
        return ApiResponse.ok(userPublicService.profile(id));
    }
}

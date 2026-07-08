package com.qoj.module.user.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.PageResult;
import com.qoj.module.user.dto.UserCreateRequest;
import com.qoj.module.user.dto.UserUpdateRequest;
import com.qoj.module.user.service.UserAdminService;
import com.qoj.module.user.service.UserAvatarService;
import com.qoj.module.user.vo.AvatarUploadVO;
import com.qoj.module.user.vo.UserVO;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/v1/users")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminUserController {
    private final UserAdminService userAdminService;
    private final UserAvatarService userAvatarService;

    public AdminUserController(UserAdminService userAdminService, UserAvatarService userAvatarService) {
        this.userAdminService = userAdminService;
        this.userAvatarService = userAvatarService;
    }

    @GetMapping
    public ApiResponse<PageResult<UserVO>> list(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize,
        @RequestParam(required = false) String role,
        @RequestParam(required = false) String keyword
    ) {
        return ApiResponse.ok(userAdminService.list(page, pageSize, role, keyword));
    }

    @GetMapping("/{id}")
    public ApiResponse<UserVO> detail(@PathVariable long id) {
        return ApiResponse.ok(userAdminService.detail(id));
    }

    @PostMapping
    public ApiResponse<UserVO> create(@Valid @RequestBody UserCreateRequest request) {
        return ApiResponse.ok(userAdminService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<UserVO> update(
        @PathVariable long id,
        @Valid @RequestBody UserUpdateRequest request
    ) {
        return ApiResponse.ok(userAdminService.update(id, request));
    }

    @PostMapping(value = "/{id}/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<AvatarUploadVO> updateAvatar(
        @PathVariable long id,
        @RequestParam("file") MultipartFile file
    ) {
        return ApiResponse.ok(userAvatarService.updateUserAvatar(id, file));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable long id) {
        userAdminService.delete(id);
        return ApiResponse.ok();
    }
}

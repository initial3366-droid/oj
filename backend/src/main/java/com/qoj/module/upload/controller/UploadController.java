package com.qoj.module.upload.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.upload.vo.UploadImageVO;
import com.qoj.module.user.service.UserAvatarService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 通用上传控制器。供富文本编辑器（比赛介绍等）上传图片使用。
 * 仅允许登录用户调用；文件类型/大小/像素校验复用 UserAvatarService 的图片校验链。
 */
@RestController
@RequestMapping("/api/v1/uploads")
public class UploadController {
    private final UserAvatarService userAvatarService;

    /**
     * 构造 Upload控制器 实例并保存其必要依赖或初始状态。
     */
    public UploadController(UserAvatarService userAvatarService) {
        this.userAvatarService = userAvatarService;
    }

    /**
     * 上传富文本图片，返回公开 URL 供 &lt;img&gt; 引用。
     */
    @PostMapping(value = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<UploadImageVO> uploadImage(@RequestParam("file") MultipartFile file) {
        return ApiResponse.ok(new UploadImageVO(userAvatarService.uploadRichTextImage(file)));
    }
}

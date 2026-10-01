package com.qoj.module.agent.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.agent.service.AdminChatImageService;
import com.qoj.module.agent.vo.AdminChatImageVO;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("${admin.api-prefix:/api/admin/v1}/agent/chat/images")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminChatImageController {
    private final AdminChatImageService images;

    public AdminChatImageController(AdminChatImageService images) { this.images = images; }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<AdminChatImageVO> upload(@RequestParam("file") MultipartFile file) {
        return ApiResponse.ok(images.upload(file));
    }

    @GetMapping("/{id}")
    public ResponseEntity<byte[]> read(@PathVariable String id) {
        var image = images.read(images.ownerId(), id);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .header("X-Content-Type-Options", "nosniff")
            .contentType(MediaType.parseMediaType(image.mimeType())).body(image.data());
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        images.delete(id);
        return ApiResponse.ok();
    }
}

package com.qoj.module.agent.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.agent.service.AdminChatFileService;
import com.qoj.module.agent.vo.AdminChatFileVO;
import java.nio.charset.StandardCharsets;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("${admin.api-prefix:/api/admin/v1}/agent/chat/files")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminChatFileController {
    private final AdminChatFileService files;
    public AdminChatFileController(AdminChatFileService files) { this.files = files; }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<AdminChatFileVO> upload(@RequestParam("file") MultipartFile file) { return ApiResponse.ok(files.upload(file)); }

    @GetMapping("/{id}")
    public ApiResponse<AdminChatFileService.Preview> preview(@PathVariable String id) { return ApiResponse.ok(files.preview(id)); }

    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable String id) {
        var file = files.read(files.ownerId(), id);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .header("X-Content-Type-Options", "nosniff")
            .header("Content-Disposition", ContentDisposition.attachment().filename(file.name(), StandardCharsets.UTF_8).build().toString())
            .contentType(MediaType.APPLICATION_OCTET_STREAM).body(file.data());
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) { files.delete(id); return ApiResponse.ok(); }
}

package com.qoj.module.contest.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.contest.dto.PolygonImportRequest;
import com.qoj.module.contest.service.PolygonContestService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("${admin.api-prefix:/api/admin/v1}/contests")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminPolygonController {
    private final PolygonContestService service;
    public AdminPolygonController(PolygonContestService service) { this.service = service; }

    @ExceptionHandler(MissingServletRequestPartException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> missingPart() {
        return ApiResponse.fail(400, "请提供 Polygon ZIP 文件及导入配置");
    }

    @PostMapping(value = "/polygon/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<PolygonContestService.Preview> preview(@RequestPart("file") MultipartFile file) {
        return ApiResponse.ok(service.preview(file));
    }

    @PostMapping(value = "/polygon/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<PolygonContestService.Imported> importContest(
        @RequestPart("file") MultipartFile file, @Valid @RequestPart("settings") PolygonImportRequest request) {
        return ApiResponse.ok(service.importContest(file, request));
    }

    @GetMapping("/{id:[0-9]+}/polygon/export")
    public ResponseEntity<byte[]> export(@PathVariable("id") long id) {
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("application/zip"))
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"contest-" + id + "-polygon.zip\"")
            .body(service.exportContest(id));
    }
}

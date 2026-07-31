package com.qoj.module.teacher.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.teacher.dto.MajorRequest;
import com.qoj.module.teacher.service.MajorService;
import com.qoj.module.teacher.vo.MajorVO;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/v1/majors")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','TEACHER')")
public class MajorController {
    private final MajorService majorService;

    public MajorController(MajorService majorService) {
        this.majorService = majorService;
    }

    @GetMapping
    public ApiResponse<List<MajorVO>> list(
        @RequestParam(required = false) String keyword,
        @RequestParam(defaultValue = "false") boolean activeOnly
    ) {
        return ApiResponse.ok(majorService.list(keyword, activeOnly));
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ApiResponse<MajorVO> create(@Valid @RequestBody MajorRequest request) {
        return ApiResponse.ok(majorService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ApiResponse<MajorVO> update(@PathVariable long id, @Valid @RequestBody MajorRequest request) {
        return ApiResponse.ok(majorService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ApiResponse<Void> delete(@PathVariable long id) {
        majorService.delete(id);
        return ApiResponse.ok();
    }
}

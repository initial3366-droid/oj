package com.qoj.module.course.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.PageResult;
import com.qoj.module.course.dto.CourseRequest;
import com.qoj.module.course.service.CourseService;
import com.qoj.module.course.vo.CourseReportVO;
import com.qoj.module.course.vo.CourseVO;
import com.qoj.module.practice.service.PracticePublicationService;
import com.qoj.module.practice.vo.PracticePublicationVO;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("${admin.api-prefix:/api/admin/v1}/courses")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','TEACHER')")
public class AdminCourseController {
    private final CourseService service;
    private final PracticePublicationService publications;
    public AdminCourseController(CourseService service, PracticePublicationService publications) {
        this.service = service;
        this.publications = publications;
    }
    @GetMapping
    public ApiResponse<PageResult<CourseVO>> list(@RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize, @RequestParam(required = false) String keyword) {
        return ApiResponse.ok(service.list(true, page, pageSize, keyword));
    }
    @GetMapping("/{id}")
    public ApiResponse<CourseVO> detail(@PathVariable long id) { return ApiResponse.ok(service.detail(id, true)); }
    @PostMapping
    public ApiResponse<CourseVO> create(@Valid @RequestBody CourseRequest request) { return ApiResponse.ok(service.create(request)); }
    @PutMapping("/{id}")
    public ApiResponse<CourseVO> update(@PathVariable long id, @Valid @RequestBody CourseRequest request) { return ApiResponse.ok(service.update(id, request)); }
    @DeleteMapping("/{id}")
    public ApiResponse<Void> archive(@PathVariable long id) { service.archive(id); return ApiResponse.ok(); }
    @GetMapping("/{id}/practices")
    public ApiResponse<List<PracticePublicationVO>> practices(@PathVariable long id) {
        return ApiResponse.ok(publications.coursePublications(id));
    }
    @GetMapping("/{id}/report")
    public ApiResponse<CourseReportVO> report(@PathVariable long id) { return ApiResponse.ok(service.report(id)); }
}

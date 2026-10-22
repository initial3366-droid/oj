package com.qoj.module.course.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.PageResult;
import com.qoj.module.course.service.CourseService;
import com.qoj.module.course.vo.CourseVO;
import com.qoj.module.course.vo.CoursePracticeVO;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/courses")
public class CourseController {
    private final CourseService service;
    public CourseController(CourseService service) { this.service = service; }
    @GetMapping
    public ApiResponse<PageResult<CourseVO>> list(@RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize, @RequestParam(required = false) String keyword) {
        return ApiResponse.ok(service.list(false, page, pageSize, keyword));
    }
    @GetMapping("/{id}")
    public ApiResponse<CourseVO> detail(@PathVariable long id) { return ApiResponse.ok(service.detail(id, false)); }
    @GetMapping("/{id}/practices")
    public ApiResponse<List<CoursePracticeVO>> practices(@PathVariable long id) { return ApiResponse.ok(service.studentPractices(id)); }
}

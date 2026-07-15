package com.qoj.module.practice.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.PageResult;
import com.qoj.module.practice.dto.PracticeCreateRequest;
import com.qoj.module.practice.dto.PracticePublicationRequest;
import com.qoj.module.practice.service.PracticeService;
import com.qoj.module.practice.service.PracticePublicationService;
import com.qoj.module.practice.vo.PracticePublicationVO;
import com.qoj.module.practice.vo.PracticeReportVO;
import com.qoj.module.practice.vo.PracticeVO;
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
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理员练习接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/admin/v1/practices")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','TEACHER')")
public class AdminPracticeController {
    private final PracticeService practiceService;
    private final PracticePublicationService publicationService;

    /**
     * 构造 管理员练习Controller 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public AdminPracticeController(PracticeService practiceService, PracticePublicationService publicationService) {
        this.practiceService = practiceService;
        this.publicationService = publicationService;
    }

    /**
     * 查询目标数据列表。返回结果包含分页边界。
     */
    @GetMapping
    public ApiResponse<PageResult<PracticeVO>> list(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "100") int pageSize
    ) {
        return ApiResponse.ok(practiceService.adminList(page, pageSize));
    }

    @PostMapping
    public ApiResponse<PracticeVO> create(@Valid @RequestBody PracticeCreateRequest request) {
        return ApiResponse.ok(practiceService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<PracticeVO> update(@PathVariable long id, @Valid @RequestBody PracticeCreateRequest request) {
        return ApiResponse.ok(practiceService.update(id, request));
    }

    @GetMapping("/{id}/report")
    public ApiResponse<PracticeReportVO> report(@PathVariable long id) {
        return ApiResponse.ok(practiceService.report(id));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable long id) {
        practiceService.delete(id);
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/copy")
    public ApiResponse<PracticeVO> copy(@PathVariable long id) {
        return ApiResponse.ok(practiceService.copy(id));
    }

    @PostMapping("/{id}/publications")
    public ApiResponse<PracticePublicationVO> publish(
        @PathVariable long id,
        @Valid @RequestBody PracticePublicationRequest request
    ) {
        return ApiResponse.ok(publicationService.publish(id, request));
    }

    @GetMapping("/publications/mine")
    public ApiResponse<java.util.List<PracticePublicationVO>> myPublications() {
        return ApiResponse.ok(publicationService.myPublications());
    }

    @GetMapping("/publications/{publicationId}")
    public ApiResponse<PracticePublicationVO> publication(@PathVariable long publicationId) {
        return ApiResponse.ok(publicationService.managementDetail(publicationId));
    }

    @PutMapping("/publications/{publicationId}")
    public ApiResponse<PracticePublicationVO> updatePublication(
        @PathVariable long publicationId,
        @Valid @RequestBody PracticePublicationRequest request
    ) {
        return ApiResponse.ok(publicationService.update(publicationId, request));
    }
}

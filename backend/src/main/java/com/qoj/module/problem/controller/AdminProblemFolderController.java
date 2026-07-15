package com.qoj.module.problem.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.PageResult;
import com.qoj.module.problem.dto.ProblemFolderRequest;
import com.qoj.module.problem.dto.ProblemFolderProblemsRequest;
import com.qoj.module.problem.service.ProblemFolderService;
import com.qoj.module.problem.vo.ProblemFolderCandidateVO;
import com.qoj.module.problem.vo.ProblemFolderVO;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 管理员题目文件夹接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/admin/v1/problem-folders")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','TEACHER')")
public class AdminProblemFolderController {
    private final ProblemFolderService folderService;

    /**
     * 构造 管理员题目文件夹Controller 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public AdminProblemFolderController(ProblemFolderService folderService) {
        this.folderService = folderService;
    }

    /**
     * 查询目标数据列表。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping
    public ApiResponse<List<ProblemFolderVO>> list() {
        return ApiResponse.ok(folderService.list());
    }

    /**
     * 封装详情相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @GetMapping("/{id}")
    public ApiResponse<ProblemFolderVO> detail(@PathVariable long id) {
        return ApiResponse.ok(folderService.detail(id));
    }

    /**
     * 创建或提交目标数据。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @PostMapping
    public ApiResponse<ProblemFolderVO> create(@Valid @RequestBody ProblemFolderRequest request) {
        return ApiResponse.ok(folderService.create(request));
    }

    /**
     * 更新目标数据。执行持久化写入。
     */
    @PutMapping("/{id}")
    public ApiResponse<ProblemFolderVO> update(@PathVariable long id, @Valid @RequestBody ProblemFolderRequest request) {
        return ApiResponse.ok(folderService.update(id, request));
    }

    /**
     * 删除目标数据。执行持久化写入。
     */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable long id) {
        folderService.delete(id);
        return ApiResponse.ok();
    }

    @GetMapping("/{id}/candidates")
    public ApiResponse<PageResult<ProblemFolderCandidateVO>> candidates(
        @PathVariable long id,
        @RequestParam(defaultValue = "ALL") String source,
        @RequestParam(required = false) Long sourceFolderId,
        @RequestParam(required = false) String keyword,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        return ApiResponse.ok(folderService.candidates(id, source, sourceFolderId, keyword, page, pageSize));
    }

    @PutMapping("/{id}/problems")
    public ApiResponse<Void> replaceProblems(
        @PathVariable long id,
        @Valid @RequestBody ProblemFolderProblemsRequest request
    ) {
        folderService.replaceProblems(id, request.problemIds());
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/problems")
    public ApiResponse<Void> replaceProblemsCompatibility(
        @PathVariable long id,
        @Valid @RequestBody ProblemFolderProblemsRequest request
    ) {
        folderService.replaceProblems(id, request.problemIds());
        return ApiResponse.ok();
    }
}

package com.qoj.module.problem.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.ErrorCode;
import com.qoj.common.PageResult;
import com.qoj.common.exception.BizException;
import com.qoj.module.problem.dto.ProblemDraftTestCasesRequest;
import com.qoj.module.problem.dto.ProblemTestCaseRequest;
import com.qoj.module.problem.dto.ProblemUpdateRequest;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.service.ProblemService;
import com.qoj.module.problem.vo.AdminProblemVO;
import com.qoj.module.problem.vo.ProblemTestCaseVO;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import com.qoj.security.policy.Permission;
import com.qoj.security.policy.ProblemAccessPolicy;
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
import org.springframework.web.multipart.MultipartFile;

/**
 * 管理员题目接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/admin/v1/problems")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','TEACHER')")
public class AdminProblemController {
    private final ProblemService problemService;
    private final ProblemMapper problemMapper;
    private final ProblemAccessPolicy problemAccessPolicy;

    /**
     * 构造 管理员题目Controller 实例并保存其必要依赖或初始状态。调用前会结合当前登录身份执行权限判断；从持久化层读取数据。
     */
    public AdminProblemController(
        ProblemService problemService,
        ProblemMapper problemMapper,
        ProblemAccessPolicy problemAccessPolicy
    ) {
        this.problemService = problemService;
        this.problemMapper = problemMapper;
        this.problemAccessPolicy = problemAccessPolicy;
    }

    @GetMapping
    public ApiResponse<PageResult<AdminProblemVO>> list(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "10") int pageSize,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) Integer difficulty,
        @RequestParam(required = false) String tag,
        @RequestParam(required = false) Long folderId,
        @RequestParam(required = false) String ownerName
    ) {
        return ApiResponse.ok(problemService.adminList(page, pageSize, keyword, difficulty, tag, folderId, ownerName));
    }

    @GetMapping("/{id}")
    public ApiResponse<?> detail(@PathVariable long id) {
        // Service层根据权限返回AdminProblemVO或PublicProblemVO
        return ApiResponse.ok(problemService.detail(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<AdminProblemVO> update(
        @PathVariable long id,
        @Valid @RequestBody ProblemUpdateRequest request
    ) {
        Problem problem = problemMapper.selectById(id);
        if (problem == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND, "题目不存在");
        }

        AuthUser user = CurrentUser.required();
        if (!problemAccessPolicy.can(user, Permission.UPDATE, problem)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN, "无权修改该题目");
        }

        return ApiResponse.ok(problemService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable long id) {
        Problem problem = problemMapper.selectById(id);
        if (problem == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND, "题目不存在");
        }

        AuthUser user = CurrentUser.required();
        if (!problemAccessPolicy.can(user, Permission.DELETE, problem)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN, "无权删除该题目");
        }

        problemService.delete(id);
        return ApiResponse.ok();
    }

    @GetMapping("/{id}/test-cases")
    public ApiResponse<List<ProblemTestCaseVO>> testCases(@PathVariable long id) {
        return ApiResponse.ok(problemService.testCases(id));
    }

    @PutMapping("/{id}/test-cases")
    public ApiResponse<List<ProblemTestCaseVO>> replaceTestCases(
        @PathVariable long id,
        @Valid @RequestBody ProblemDraftTestCasesRequest request
    ) {
        Problem problem = problemMapper.selectById(id);
        if (problem == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND, "题目不存在");
        }

        AuthUser user = CurrentUser.required();
        if (!problemAccessPolicy.can(user, Permission.UPDATE, problem)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN, "无权修改该题目");
        }

        return ApiResponse.ok(problemService.replaceHiddenTestCases(id, request.testCases()));
    }

    @PostMapping("/{id}/test-cases")
    public ApiResponse<ProblemTestCaseVO> addTestCase(
        @PathVariable long id,
        @Valid @RequestBody ProblemTestCaseRequest request
    ) {
        Problem problem = problemMapper.selectById(id);
        if (problem == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND, "题目不存在");
        }

        AuthUser user = CurrentUser.required();
        if (!problemAccessPolicy.can(user, Permission.UPDATE, problem)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN, "无权修改该题目");
        }

        return ApiResponse.ok(problemService.addTestCase(id, request));
    }

    @PutMapping("/{id}/test-cases/{testCaseId}")
    public ApiResponse<ProblemTestCaseVO> updateTestCase(
        @PathVariable long id,
        @PathVariable long testCaseId,
        @Valid @RequestBody ProblemTestCaseRequest request
    ) {
        Problem problem = problemMapper.selectById(id);
        if (problem == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND, "题目不存在");
        }

        AuthUser user = CurrentUser.required();
        if (!problemAccessPolicy.can(user, Permission.UPDATE, problem)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN, "无权修改该题目");
        }

        return ApiResponse.ok(problemService.updateTestCase(id, testCaseId, request));
    }

    @DeleteMapping("/{id}/test-cases/{testCaseId}")
    public ApiResponse<Void> deleteTestCase(
        @PathVariable long id,
        @PathVariable long testCaseId
    ) {
        Problem problem = problemMapper.selectById(id);
        if (problem == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND, "题目不存在");
        }

        AuthUser user = CurrentUser.required();
        if (!problemAccessPolicy.can(user, Permission.UPDATE, problem)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN, "无权修改该题目");
        }

        problemService.deleteTestCase(id, testCaseId);
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/test-cases/zip")
    public ApiResponse<Void> importZip(
        @PathVariable long id,
        @RequestParam("file") MultipartFile file,
        @RequestParam(defaultValue = "false") boolean overwrite
    ) {
        Problem problem = problemMapper.selectById(id);
        if (problem == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND, "题目不存在");
        }

        AuthUser user = CurrentUser.required();
        if (!problemAccessPolicy.can(user, Permission.UPDATE, problem)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN, "无权修改该题目");
        }

        problemService.importHiddenTestCases(id, file, overwrite);
        return ApiResponse.ok();
    }
}

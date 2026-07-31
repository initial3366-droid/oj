package com.qoj.module.contest.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.ErrorCode;
import com.qoj.common.PageResult;
import com.qoj.common.exception.BizException;
import com.qoj.module.contest.dto.ContestCreateRequest;
import com.qoj.module.contest.dto.ContestDraftRequest;
import com.qoj.module.contest.dto.ContestUpdateRequest;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.entity.ContestProblem;
import com.qoj.module.contest.entity.ContestRegistration;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.contest.mapper.ContestProblemMapper;
import com.qoj.module.contest.mapper.ContestRegistrationMapper;
import com.qoj.module.contest.service.ContestInspectionExportService;
import com.qoj.module.contest.service.ContestService;
import com.qoj.module.contest.vo.ContestVO;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import com.qoj.security.policy.ContestAccessPolicy;
import com.qoj.security.policy.Permission;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理员比赛接口控制器。负责接收 HTTP 请求、校验调用参数，并将业务层结果包装为统一响应。
 */
@RestController
@RequestMapping("/api/admin/v1/contests")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','TEACHER')")
public class AdminContestController {
    private final ContestService contestService;
    private final ContestMapper contestMapper;
    private final ContestProblemMapper contestProblemMapper;
    private final ContestRegistrationMapper contestRegistrationMapper;
    private final ContestAccessPolicy contestAccessPolicy;
    private final ContestInspectionExportService contestInspectionExportService;

    /**
     * 构造 管理员比赛Controller 实例并保存其必要依赖或初始状态。调用前会结合当前登录身份执行权限判断；从持久化层读取数据。
     */
    public AdminContestController(
        ContestService contestService,
        ContestMapper contestMapper,
        ContestProblemMapper contestProblemMapper,
        ContestRegistrationMapper contestRegistrationMapper,
        ContestAccessPolicy contestAccessPolicy,
        ContestInspectionExportService contestInspectionExportService
    ) {
        this.contestService = contestService;
        this.contestMapper = contestMapper;
        this.contestProblemMapper = contestProblemMapper;
        this.contestRegistrationMapper = contestRegistrationMapper;
        this.contestAccessPolicy = contestAccessPolicy;
        this.contestInspectionExportService = contestInspectionExportService;
    }

    @GetMapping
    public ApiResponse<PageResult<ContestVO>> list(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize
    ) {
        return ApiResponse.ok(contestService.adminList(page, pageSize));
    }

    @PostMapping
    public ApiResponse<ContestVO> create(@Valid @RequestBody ContestCreateRequest request) {
        return ApiResponse.ok(contestService.create(request));
    }

    @GetMapping("/{id}")
    public ApiResponse<ContestVO> detail(@PathVariable long id) {
        return ApiResponse.ok(contestService.detail(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<ContestVO> update(@PathVariable long id, @Valid @RequestBody ContestUpdateRequest request) {
        Contest contest = contestMapper.selectById(id);
        if (contest == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND, "比赛不存在");
        }

        AuthUser user = CurrentUser.required();
        if (!contestAccessPolicy.can(user, Permission.UPDATE, contest)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN, "无权修改该比赛");
        }

        return ApiResponse.ok(contestService.update(id, request));
    }

    @GetMapping("/draft")
    public ApiResponse<ContestDraftRequest> draft() {
        return ApiResponse.ok(contestService.draft());
    }

    @PutMapping("/draft")
    public ApiResponse<ContestDraftRequest> saveDraft(@RequestBody ContestDraftRequest request) {
        return ApiResponse.ok(contestService.saveDraft(request));
    }

    @DeleteMapping("/draft")
    public ApiResponse<Void> clearDraft() {
        contestService.clearDraft();
        return ApiResponse.ok();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable long id) {
        Contest contest = contestMapper.selectById(id);
        if (contest == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND, "比赛不存在");
        }

        AuthUser user = CurrentUser.required();
        if (!contestAccessPolicy.can(user, Permission.DELETE, contest)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN, "无权删除该比赛");
        }

        contestService.delete(id);
        return ApiResponse.ok();
    }

    @GetMapping("/{id}/problems")
    public ApiResponse<List<ContestProblem>> getContestProblems(@PathVariable long id) {
        Contest contest = contestMapper.selectById(id);
        if (contest == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND, "比赛不存在");
        }

        List<ContestProblem> problems = contestProblemMapper.selectList(
            new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<ContestProblem>()
                .eq("contest_id", id)
                .orderByAsc("display_order")
        );
        return ApiResponse.ok(problems);
    }

    @GetMapping("/{id}/registrations")
    public ApiResponse<List<com.qoj.module.contest.vo.ContestRegistrationVO>> getContestRegistrations(@PathVariable long id) {
        Contest contest = contestMapper.selectById(id);
        if (contest == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND, "比赛不存在");
        }
        AuthUser user = CurrentUser.required();
        if (!contestAccessPolicy.can(user, Permission.MANAGE_REGISTRATION, contest)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN, "无权查看该比赛报名列表");
        }

        List<ContestRegistration> registrations = contestRegistrationMapper.selectList(
            new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<ContestRegistration>()
                .eq("contest_id", id)
                .eq("status", "APPROVED")
                .orderByDesc("registered_at")
        );

        // 转换为VO确保字段名正确
        List<com.qoj.module.contest.vo.ContestRegistrationVO> vos = registrations.stream().map(r -> {
            com.qoj.module.contest.vo.ContestRegistrationVO vo = new com.qoj.module.contest.vo.ContestRegistrationVO();
            vo.id = r.id;
            vo.contestId = r.contestId;
            vo.userId = r.userId;
            vo.username = r.username;
            vo.displayName = r.displayName;
            vo.identityType = r.identityType;
            vo.identityId = r.identityId;
            vo.starred = r.starred;
            vo.status = r.status;
            vo.registeredAt = r.registeredAt;
            return vo;
        }).collect(java.util.stream.Collectors.toList());

        return ApiResponse.ok(vos);
    }

    @GetMapping("/{id}/scoreboard/export")
    public ResponseEntity<byte[]> exportScoreboard(@PathVariable long id) {
        String filename = contestInspectionExportService.scoreboardFilename(id);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, attachment(filename))
            .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
            .body(contestInspectionExportService.scoreboardCsv(id));
    }

    @GetMapping("/{id}/submissions/export")
    public ResponseEntity<byte[]> exportSubmissions(@PathVariable long id) {
        String filename = contestInspectionExportService.submissionsZipFilename(id);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, attachment(filename))
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .body(contestInspectionExportService.submissionsZip(id));
    }

    @GetMapping("/{id}/registrations/export")
    public ResponseEntity<byte[]> exportRegistrationUsers(@PathVariable long id) {
        String filename = contestInspectionExportService.registrationUsersFilename(id);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, attachment(filename))
            .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
            .body(contestInspectionExportService.registrationUsersCsv(id));
    }

    private String attachment(String filename) {
        return ContentDisposition.attachment()
            .filename(filename, StandardCharsets.UTF_8)
            .build()
            .toString();
    }
}

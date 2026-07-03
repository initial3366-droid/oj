package com.qoj.module.submission.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.PageResult;
import com.qoj.module.submission.dto.SubmissionQueuePriorityRequest;
import java.util.Map;
import com.qoj.module.submission.service.SubmissionQueueService;
import com.qoj.module.submission.vo.SubmissionQueueLogVO;
import com.qoj.module.submission.vo.SubmissionQueueVO;
import jakarta.validation.Valid;
import java.time.LocalDateTime;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/admin/v1/submission-queue", "/api/admin/submission-queue"})
@PreAuthorize("hasAnyRole('SUPER_ADMIN','CLUB_ADMIN')")
public class AdminSubmissionQueueController {
    private final SubmissionQueueService submissionQueueService;

    public AdminSubmissionQueueController(SubmissionQueueService submissionQueueService) {
        this.submissionQueueService = submissionQueueService;
    }

    @GetMapping
    public ApiResponse<PageResult<SubmissionQueueVO>> list(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int pageSize,
        @RequestParam(required = false) Long contestId,
        @RequestParam(required = false) Long problemId,
        @RequestParam(required = false) Long userId,
        @RequestParam(required = false) String language,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String judgeServer,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
        @RequestParam(required = false) String sortBy,
        @RequestParam(required = false) String sortOrder
    ) {
        return ApiResponse.ok(submissionQueueService.list(
            page,
            pageSize,
            contestId,
            problemId,
            userId,
            language,
            status,
            judgeServer,
            from,
            to,
            sortBy,
            sortOrder,
            false
        ));
    }

    @GetMapping("/{queueId}")
    public ApiResponse<SubmissionQueueVO> detail(@PathVariable long queueId) {
        return ApiResponse.ok(submissionQueueService.detail(queueId, false));
    }

    @PostMapping("/{queueId}/rejudge")
    public ApiResponse<SubmissionQueueVO> rejudge(@PathVariable long queueId) {
        return ApiResponse.ok(submissionQueueService.rejudge(queueId));
    }

    @PostMapping("/{queueId}/cancel")
    public ApiResponse<SubmissionQueueVO> cancel(@PathVariable long queueId) {
        return ApiResponse.ok(submissionQueueService.cancel(queueId));
    }

    @PostMapping("/{queueId}/priority")
    public ApiResponse<SubmissionQueueVO> updatePriority(
        @PathVariable long queueId,
        @Valid @RequestBody SubmissionQueuePriorityRequest request
    ) {
        return ApiResponse.ok(submissionQueueService.updatePriority(queueId, request.priority()));
    }

    @DeleteMapping("/{queueId}")
    public ApiResponse<Void> delete(@PathVariable long queueId) {
        submissionQueueService.delete(queueId);
        return ApiResponse.ok();
    }

    @GetMapping("/{queueId}/logs")
    public ApiResponse<SubmissionQueueLogVO> logs(@PathVariable long queueId) {
        return ApiResponse.ok(submissionQueueService.logs(queueId));
    }

    @GetMapping("/stats")
    public ApiResponse<Map<String, Object>> stats(
        @RequestParam(required = false) Long contestId,
        @RequestParam(required = false) Long problemId,
        @RequestParam(required = false) Long userId,
        @RequestParam(required = false) String language,
        @RequestParam(required = false) String judgeServer,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to
    ) {
        return ApiResponse.ok(submissionQueueService.stats(
            contestId,
            problemId,
            userId,
            language,
            judgeServer,
            from,
            to
        ));
    }
}

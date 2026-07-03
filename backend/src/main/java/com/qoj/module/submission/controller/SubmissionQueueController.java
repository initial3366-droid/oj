package com.qoj.module.submission.controller;

import com.qoj.common.ApiResponse;
import com.qoj.common.PageResult;
import com.qoj.module.submission.service.SubmissionQueueService;
import com.qoj.module.submission.vo.SubmissionQueueVO;
import java.time.LocalDateTime;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/v1/submission-queue", "/api/submission-queue"})
public class SubmissionQueueController {
    private final SubmissionQueueService submissionQueueService;

    public SubmissionQueueController(SubmissionQueueService submissionQueueService) {
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
            null,
            problemId,
            null,
            language,
            status,
            null,
            null,
            null,
            sortBy,
            sortOrder,
            true
        ));
    }

    @GetMapping("/{queueId}")
    public ApiResponse<SubmissionQueueVO> detail(@PathVariable long queueId) {
        return ApiResponse.ok(submissionQueueService.detail(queueId, true));
    }
}

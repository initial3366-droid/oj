package com.qoj.module.contest.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.contest.dto.ContestMessageRequest;
import com.qoj.module.contest.service.ContestMessageService;
import com.qoj.module.contest.vo.ContestMessageFeedVO;
import com.qoj.module.contest.vo.ContestMessageVO;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("${admin.api-prefix:/api/admin/v1}/contests/{contestId}/messages")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','TEACHER')")
public class AdminContestMessageController {
    private final ContestMessageService messages;
    public AdminContestMessageController(ContestMessageService messages) { this.messages = messages; }

    @GetMapping
    public ApiResponse<ContestMessageFeedVO> feed(@PathVariable long contestId, @RequestParam(defaultValue = "0") long afterId) {
        return ApiResponse.ok(messages.feed(contestId, Math.max(0, afterId), true));
    }

    @PostMapping("/reply")
    public ApiResponse<ContestMessageVO> reply(@PathVariable long contestId, @Valid @RequestBody ContestMessageRequest request) {
        return ApiResponse.ok(messages.send(contestId, request, "REPLY"));
    }

    @PostMapping("/broadcast")
    public ApiResponse<ContestMessageVO> broadcast(@PathVariable long contestId, @Valid @RequestBody ContestMessageRequest request) {
        return ApiResponse.ok(messages.send(contestId, request, "BROADCAST"));
    }
}

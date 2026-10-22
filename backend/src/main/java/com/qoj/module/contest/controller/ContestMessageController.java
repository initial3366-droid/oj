package com.qoj.module.contest.controller;

import com.qoj.common.ApiResponse;
import com.qoj.module.contest.dto.ContestMessageRequest;
import com.qoj.module.contest.service.ContestMessageService;
import com.qoj.module.contest.vo.ContestMessageFeedVO;
import com.qoj.module.contest.vo.ContestMessageVO;
import jakarta.validation.Valid;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/contests/{contestId}/messages")
@PreAuthorize("isAuthenticated()")
public class ContestMessageController {
    private final ContestMessageService messages;
    public ContestMessageController(ContestMessageService messages) { this.messages = messages; }

    @GetMapping
    public ApiResponse<ContestMessageFeedVO> feed(@PathVariable long contestId,
        @RequestParam(defaultValue = "0") long afterId) {
        return ApiResponse.ok(messages.feed(contestId, Math.max(0, afterId), false));
    }

    @PostMapping
    public ApiResponse<ContestMessageVO> question(@PathVariable long contestId, @Valid @RequestBody ContestMessageRequest request) {
        return ApiResponse.ok(messages.send(contestId, request, "QUESTION"));
    }

    public record ReadRequest(@PositiveOrZero long throughId) {}

    @PostMapping("/read")
    public ApiResponse<Void> read(@PathVariable long contestId, @Valid @RequestBody ReadRequest request) {
        messages.markRead(contestId, request.throughId());
        return ApiResponse.ok();
    }
}

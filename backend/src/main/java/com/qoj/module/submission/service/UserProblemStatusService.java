package com.qoj.module.submission.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.common.enums.SubmissionStatus;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.entity.UserProblemStatus;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.submission.mapper.UserProblemStatusMapper;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class UserProblemStatusService {
    private final UserProblemStatusMapper userProblemStatusMapper;
    private final SubmissionMapper submissionMapper;

    public UserProblemStatusService(
        UserProblemStatusMapper userProblemStatusMapper,
        SubmissionMapper submissionMapper
    ) {
        this.userProblemStatusMapper = userProblemStatusMapper;
        this.submissionMapper = submissionMapper;
    }

    public void recordSubmitted(Submission submission) {
        record(submission, true);
    }

    public void recordJudged(Submission submission) {
        recompute(submission);
    }

    public void recompute(Long userId, Long problemId) {
        if (userId == null || problemId == null) {
            return;
        }
        Submission probe = new Submission();
        probe.userId = userId;
        probe.problemId = problemId;
        recompute(probe);
    }

    private void record(Submission submission, boolean increment) {
        if (submission == null || submission.userId == null || submission.problemId == null || submission.status == null) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime submittedAt = submission.createdAt == null ? now : submission.createdAt;
        LocalDateTime acceptedAt = SubmissionStatus.AC.name().equals(submission.status) ? now : null;
        userProblemStatusMapper.upsertStatus(
            submission.userId,
            submission.problemId,
            submission.status,
            submission.id,
            increment ? 1 : 0,
            acceptedAt,
            submittedAt
        );
    }

    private void recompute(Submission submission) {
        if (submission == null || submission.userId == null || submission.problemId == null) {
            return;
        }
        List<Submission> submissions = submissionMapper.selectList(
            new QueryWrapper<Submission>()
                .eq("user_id", submission.userId)
                .eq("problem_id", submission.problemId)
                .isNull("contest_id")
                .orderByDesc("created_at")
                .orderByDesc("id")
        );
        if (submissions.isEmpty()) {
            userProblemStatusMapper.delete(
                new QueryWrapper<UserProblemStatus>()
                    .eq("user_id", submission.userId)
                    .eq("problem_id", submission.problemId)
            );
            return;
        }
        Submission latest = submissions.get(0);
        String bestStatus = submissions.stream().anyMatch(item -> SubmissionStatus.AC.name().equals(item.status))
            ? SubmissionStatus.AC.name()
            : latest.status;
        LocalDateTime acceptedAt = submissions
            .stream()
            .filter(item -> SubmissionStatus.AC.name().equals(item.status))
            .map(item -> item.createdAt)
            .filter(item -> item != null)
            .min(Comparator.naturalOrder())
            .orElse(null);
        userProblemStatusMapper.replaceComputedStatus(
            submission.userId,
            submission.problemId,
            bestStatus,
            latest.status,
            latest.id,
            submissions.size(),
            acceptedAt,
            latest.createdAt == null ? LocalDateTime.now() : latest.createdAt
        );
    }
}

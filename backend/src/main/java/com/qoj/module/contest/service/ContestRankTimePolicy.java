package com.qoj.module.contest.service;

import com.qoj.module.contest.entity.Contest;
import com.qoj.module.submission.entity.Submission;

import java.time.LocalDateTime;

/** Shared contest-window rule for ACM and OI ranking updates. */
final class ContestRankTimePolicy {
    private ContestRankTimePolicy() {}

    static boolean isRankedSubmission(Contest contest, Submission submission) {
        LocalDateTime submittedAt = submission.submitTime == null ? submission.createdAt : submission.submitTime;
        if (contest.startTime == null || contest.endTime == null || submittedAt == null) {
            return false;
        }
        return !submittedAt.isBefore(contest.startTime) && !submittedAt.isAfter(contest.endTime);
    }
}

package com.qoj.module.contest.service;

import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionMapper;
import org.springframework.stereotype.Component;

/** Keeps Lanqiao submission receipts independent from judging results. */
@Component
public class ContestFeedbackPolicy {
    private final SubmissionMapper submissions;
    private final ContestMapper contests;

    public ContestFeedbackPolicy(SubmissionMapper submissions, ContestMapper contests) {
        this.submissions = submissions;
        this.contests = contests;
    }

    public static boolean isLanqiao(Contest contest) {
        return contest != null && "LANQIAO".equals(contest.type);
    }

    public static boolean usesScores(Contest contest) {
        return contest != null && ("OI".equals(contest.type) || isLanqiao(contest));
    }

    public boolean hidesSubmission(Long submissionId) {
        Submission submission = submissions.selectById(submissionId);
        return submission != null && submission.contestId != null
            && isLanqiao(contests.selectById(submission.contestId));
    }
}

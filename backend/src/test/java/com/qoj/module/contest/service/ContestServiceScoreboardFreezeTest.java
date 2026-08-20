package com.qoj.module.contest.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.entity.ContestProblem;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.contest.mapper.ContestProblemMapper;
import com.qoj.module.contest.vo.ContestScoreboardCellVO;
import com.qoj.module.contest.vo.ContestScoreboardVO;
import com.qoj.module.contest.vo.PublicScoreboardVO;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.user.mapper.UserMapper;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContestServiceScoreboardFreezeTest {
    @Mock private ContestMapper contestMapper;
    @Mock private ContestProblemMapper contestProblemMapper;
    @Mock private ProblemMapper problemMapper;
    @Mock private SubmissionMapper submissionMapper;
    @Mock private UserMapper userMapper;
    @Mock private com.qoj.security.policy.ContestAccessPolicy contestAccessPolicy;
    @InjectMocks private ContestService contestService;

    private Contest contest;
    private ContestProblem contestProblem;
    private Problem problem;
    private LocalDateTime freezeTime;

    @BeforeEach
    void setUp() {
        LocalDateTime now = LocalDateTime.now();
        freezeTime = now.minusHours(1);

        contest = new Contest();
        contest.id = 1L;
        contest.type = "ACM";
        contest.startTime = now.minusHours(2);
        contest.freezeTime = freezeTime;
        contest.endTime = now.plusHours(1);
        contest.frozen = true;
        contest.showClassOnScoreboard = false;

        contestProblem = new ContestProblem();
        contestProblem.id = 10L;
        contestProblem.contestId = contest.id;
        contestProblem.problemId = 100L;
        contestProblem.label = "A";
        contestProblem.title = "Problem A";

        problem = new Problem();
        problem.id = contestProblem.problemId;
        problem.title = contestProblem.title;

        when(contestMapper.selectById(contest.id)).thenReturn(contest);
        when(contestProblemMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(contestProblem));
        when(problemMapper.selectBatchIds(any())).thenReturn(List.of(problem));
        when(userMapper.selectBatchIds(any())).thenReturn(List.of());
    }

    @Test
    void repeatedAcceptedSubmissionAfterFreezeDoesNotMarkCellHidden() {
        Submission beforeFreeze = submission(1L, "AC", freezeTime.minusMinutes(10));
        Submission afterFreeze = submission(2L, "AC", freezeTime.plusMinutes(10));
        when(submissionMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(beforeFreeze, afterFreeze));

        ContestScoreboardCellVO cell = scoreboardCell();

        assertTrue(cell.accepted());
        assertEquals(1, cell.attempts());
        assertFalse(cell.hasHiddenSubmissions());
        assertEquals(0, cell.hiddenAttempts());
    }

    @Test
    void submissionAfterFreezeStillMarksAnUnsolvedCellHidden() {
        Submission beforeFreeze = submission(1L, "WA", freezeTime.minusMinutes(10));
        Submission afterFreeze = submission(2L, "AC", freezeTime.plusMinutes(10));
        when(submissionMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(beforeFreeze, afterFreeze));

        ContestScoreboardCellVO cell = scoreboardCell();

        assertFalse(cell.accepted());
        assertEquals(1, cell.attempts());
        assertTrue(cell.hasHiddenSubmissions());
        assertEquals(1, cell.hiddenAttempts());
    }

    @Test
    void endedContestKeepsThePrivateScoreboardFrozen() {
        contest.endTime = LocalDateTime.now().minusMinutes(1);
        Submission beforeFreeze = submission(1L, "WA", freezeTime.minusMinutes(10));
        Submission afterFreeze = submission(2L, "AC", freezeTime.plusMinutes(10));
        when(submissionMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(beforeFreeze, afterFreeze));

        ContestScoreboardVO scoreboard = contestService.scoreboard(contest.id);
        ContestScoreboardCellVO cell = scoreboard.rows().get(0).cells().get(0);

        assertEquals("FROZEN", scoreboard.boardState());
        assertEquals(1, cell.attempts());
        assertTrue(cell.hasHiddenSubmissions());
    }

    @Test
    void endedContestKeepsThePublicScoreboardFrozen() {
        contest.endTime = LocalDateTime.now().minusMinutes(1);
        contest.publicScoreboardEnabled = true;
        Submission beforeFreeze = submission(1L, "WA", freezeTime.minusMinutes(10));
        Submission afterFreeze = submission(2L, "AC", freezeTime.plusMinutes(10));
        when(submissionMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(beforeFreeze, afterFreeze));

        PublicScoreboardVO scoreboard = contestService.getPublicScoreboard(contest.id);
        PublicScoreboardVO.ProblemStatus status = scoreboard.rows.get(0).problems.get("A");

        assertEquals("FROZEN", scoreboard.boardState);
        assertEquals(1, status.attempts);
        assertTrue(status.hasHiddenSubmissions);
    }

    private ContestScoreboardCellVO scoreboardCell() {
        ContestScoreboardVO scoreboard = contestService.scoreboardForRolling(contest.id, false);
        return scoreboard.rows().get(0).cells().get(0);
    }

    private Submission submission(Long id, String status, LocalDateTime submittedAt) {
        Submission submission = new Submission();
        submission.id = id;
        submission.userId = 7L;
        submission.problemId = contestProblem.problemId;
        submission.contestId = contest.id;
        submission.contestProblemId = contestProblem.id;
        submission.status = status;
        submission.submitTime = submittedAt;
        submission.createdAt = submittedAt;
        return submission;
    }
}

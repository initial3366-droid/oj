package com.qoj.module.submission.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.qoj.common.ErrorCode;
import com.qoj.common.PageResult;
import com.qoj.common.enums.SubmissionStatus;
import com.qoj.common.exception.BizException;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.entity.ContestProblem;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.contest.mapper.ContestProblemMapper;
import com.qoj.module.judge.dto.DomjudgeSubmissionResponse;
import com.qoj.module.judge.service.DomjudgeAdapter;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.setting.service.SystemSettingService;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.submission.vo.SubmissionQueueLogVO;
import com.qoj.module.submission.vo.SubmissionQueueVO;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.ws.JudgeMessagePublisher;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import com.qoj.security.audit.AuditLogger;
import com.qoj.security.policy.Permission;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SubmissionQueueService {
    private static final long MAX_REASONABLE_RUNNING_TIME_MILLIS = Duration.ofHours(6).toMillis();

    private final SubmissionMapper submissionMapper;
    private final ContestMapper contestMapper;
    private final ContestProblemMapper contestProblemMapper;
    private final ProblemMapper problemMapper;
    private final UserMapper userMapper;
    private final DomjudgeAdapter domjudgeAdapter;
    private final SubmissionService submissionService;
    private final AuditLogger auditLogger;
    private final JudgeMessagePublisher judgeMessagePublisher;
    private final SystemSettingService settingService;
    private final com.qoj.security.policy.ContestAccessPolicy contestAccessPolicy;

    public SubmissionQueueService(
        SubmissionMapper submissionMapper,
        ContestMapper contestMapper,
        ContestProblemMapper contestProblemMapper,
        ProblemMapper problemMapper,
        UserMapper userMapper,
        DomjudgeAdapter domjudgeAdapter,
        SubmissionService submissionService,
        AuditLogger auditLogger,
        JudgeMessagePublisher judgeMessagePublisher,
        SystemSettingService settingService,
        com.qoj.security.policy.ContestAccessPolicy contestAccessPolicy
    ) {
        this.submissionMapper = submissionMapper;
        this.contestMapper = contestMapper;
        this.contestProblemMapper = contestProblemMapper;
        this.problemMapper = problemMapper;
        this.userMapper = userMapper;
        this.domjudgeAdapter = domjudgeAdapter;
        this.submissionService = submissionService;
        this.auditLogger = auditLogger;
        this.judgeMessagePublisher = judgeMessagePublisher;
        this.settingService = settingService;
        this.contestAccessPolicy = contestAccessPolicy;
    }

    public PageResult<SubmissionQueueVO> list(
        int page,
        int pageSize,
        Long contestId,
        Long problemId,
        Long userId,
        String language,
        String status,
        String judgeServer,
        LocalDateTime from,
        LocalDateTime to,
        String sortBy,
        String sortOrder,
        boolean practiceOnly
    ) {
        AuthUser authUser = CurrentUser.get();
        QueryWrapper<Submission> wrapper = new QueryWrapper<>();
        if (practiceOnly) {
        } else {
            if (contestId != null) {
                ensureCanManageContest(authUser, contestId);
            } else {
                applyVisibility(wrapper, authUser);
            }
        }
        applyFilters(wrapper, contestId, problemId, userId, language, status, judgeServer, from, to);
        applySorting(wrapper, sortBy, sortOrder);
        Page<Submission> result = submissionMapper.selectPage(Page.of(page, pageSize), wrapper);
        boolean includeLogs = authUser != null && canViewAllLogs(authUser);
        return new PageResult<>(
            result.getTotal(),
            result.getRecords().stream().map(item -> toVO(item, includeLogs || (authUser != null && isContestManager(authUser, item)))).toList()
        );
    }

    public SubmissionQueueVO detail(long queueId, boolean practiceOnly) {
        AuthUser authUser = CurrentUser.get();
        Submission submission = requireSubmission(queueId);
        if (practiceOnly) {
        } else if (!canViewQueue(authUser, submission)) {
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无权查看该队列任务");
        }
        return toVO(submission, authUser != null && canViewLogs(authUser, submission));
    }

    @Transactional
    public SubmissionQueueVO rejudge(long queueId) {
        AuthUser authUser = CurrentUser.required();
        Submission submission = requireSubmission(queueId);
        ensureCanOperate(authUser, submission, Permission.QUEUE_REJUDGE, "无权重新判题该队列任务");

        submission.status = SubmissionStatus.REJUDGE_PENDING.name();
        submission.isRejudged = true;
        submission.retryCount = safeInt(submission.retryCount) + 1;
        submission.priority = Math.max(safeInt(submission.priority), 1);
        submission.judgeStartTime = null;
        submission.judgeEndTime = null;
        submission.errorMessage = null;
        submission.judgeMessage = null;

        if (domjudgeAdapter.enabled()) {
            DomjudgeSubmissionResponse response = domjudgeAdapter.submit(
                submission.contestId == null ? null : String.valueOf(submission.contestId),
                domjudgeProblemId(submission),
                submission.language,
                submission.code
            );
            submission.domjudgeSubmissionId = response == null ? null : response.submissionId();
            submission.status = SubmissionStatus.JUDGING.name();
            submission.judgeServer = "DOMJUDGE";
            submission.judgeStartTime = LocalDateTime.now();
        }

        submissionMapper.updateById(submission);
        auditLogger.logPermissionAllowed(authUser, Permission.QUEUE_REJUDGE, "SubmissionQueue", queueId, "管理员重新判题");
        judgeMessagePublisher.submissionQueueUpdated();
        return toVO(submission, true);
    }

    @Transactional
    public SubmissionQueueVO cancel(long queueId) {
        AuthUser authUser = CurrentUser.required();
        Submission submission = requireSubmission(queueId);
        ensureCanOperate(authUser, submission, Permission.QUEUE_CANCEL, "无权取消该队列任务");

        if (isFinalStatus(submission.status)) {
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "已完成任务不能取消");
        }
        submission.status = SubmissionStatus.FAILED.name();
        submission.judgeEndTime = LocalDateTime.now();
        submission.errorMessage = "队列任务已被管理员取消";
        submissionMapper.updateById(submission);
        auditLogger.logPermissionAllowed(authUser, Permission.QUEUE_CANCEL, "SubmissionQueue", queueId, "管理员取消队列任务");
        judgeMessagePublisher.submissionQueueUpdated();
        return toVO(submission, true);
    }

    @Transactional
    public SubmissionQueueVO updatePriority(long queueId, int priority) {
        AuthUser authUser = CurrentUser.required();
        Submission submission = requireSubmission(queueId);
        ensureCanOperate(authUser, submission, Permission.QUEUE_UPDATE_PRIORITY, "无权调整该队列任务优先级");

        submission.priority = priority;
        submissionMapper.updateById(submission);
        auditLogger.logPermissionAllowed(authUser, Permission.QUEUE_UPDATE_PRIORITY, "SubmissionQueue", queueId, "管理员调整优先级");
        judgeMessagePublisher.submissionQueueUpdated();
        return toVO(submission, true);
    }

    @Transactional
    public void delete(long queueId) {
        AuthUser authUser = CurrentUser.required();
        Submission submission = requireSubmission(queueId);
        ensureCanOperate(authUser, submission, Permission.DELETE, "无权删除该队列任务");
        submissionService.adminDelete(queueId);
        auditLogger.logPermissionAllowed(authUser, Permission.DELETE, "SubmissionQueue", queueId, "管理员删除队列任务");
    }

    public SubmissionQueueLogVO logs(long queueId) {
        AuthUser authUser = CurrentUser.required();
        Submission submission = requireSubmission(queueId);
        if (!canViewLogs(authUser, submission)) {
            auditLogger.logPermissionDenied(authUser, Permission.QUEUE_VIEW_LOGS, "SubmissionQueue", queueId, "无日志查看权限");
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无权查看队列错误日志");
        }
        auditLogger.logPermissionAllowed(authUser, Permission.QUEUE_VIEW_LOGS, "SubmissionQueue", queueId, "管理员查看错误日志");
        return new SubmissionQueueLogVO(
            submission.id,
            submission.id,
            submission.status,
            submission.judgeServer,
            submission.judgeMessage,
            submission.errorMessage,
            submitTime(submission),
            submission.judgeStartTime,
            submission.judgeEndTime
        );
    }

    private Submission requireSubmission(long queueId) {
        Submission submission = submissionMapper.selectById(queueId);
        if (submission == null) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "队列任务不存在");
        }
        return submission;
    }

    private void applyVisibility(QueryWrapper<Submission> wrapper, AuthUser authUser) {
        if (isSuperAdmin(authUser)) {
            return;
        }
        if (authUser.adminAccount()) {
            wrapper.and(scope -> scope
                .inSql(
                    "contest_id",
                    "SELECT id FROM contests WHERE owner_id = " + authUser.id() + " AND owner_account_type = 'ADMIN'"
                )
                .or()
                .inSql(
                    "practice_id",
                    "SELECT id FROM practices WHERE owner_id = " + authUser.id()
                )
                .or(item -> item
                    .isNull("contest_id")
                    .inSql("problem_id", "SELECT id FROM problems WHERE owner_id = " + authUser.id())
                )
            );
            return;
        }
        if (isContestAdminRole(authUser)) {
            wrapper.inSql(
                "contest_id",
                "SELECT id FROM contests WHERE owner_id = " + authUser.id() + " AND owner_account_type = 'USER'"
            );
            return;
        }
        wrapper.eq("user_id", authUser.id());
    }

    private void ensureCanManageContest(AuthUser authUser, Long contestId) {
        if (authUser == null || !authUser.adminAccount()) {
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无权查看该比赛队列");
        }
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "比赛不存在");
        }
        if (!contestAccessPolicy.can(authUser, Permission.MANAGE_SCOREBOARD, contest)) {
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无权查看该比赛队列");
        }
    }

    private void applyFilters(
        QueryWrapper<Submission> wrapper,
        Long contestId,
        Long problemId,
        Long userId,
        String language,
        String status,
        String judgeServer,
        LocalDateTime from,
        LocalDateTime to
    ) {
        if (contestId != null) {
            wrapper.eq("contest_id", contestId);
        }
        if (problemId != null) {
            wrapper.and(item -> item.eq("problem_id", problemId).or().eq("contest_problem_id", problemId));
        }
        if (userId != null) {
            wrapper.eq("user_id", userId);
        }
        if (language != null && !language.isBlank()) {
            wrapper.eq("language", language.trim());
        }
        String normalizedStatus = normalizeStatus(status);
        if (normalizedStatus != null) {
            wrapper.eq("status", normalizedStatus);
        }
        if (judgeServer != null && !judgeServer.isBlank()) {
            wrapper.eq("judge_server", judgeServer.trim());
        }
        if (from != null) {
            wrapper.ge("submit_time", from);
        }
        if (to != null) {
            wrapper.le("submit_time", to);
        }
    }

    private void applySorting(QueryWrapper<Submission> wrapper, String sortBy, String sortOrder) {
        String column = switch ((sortBy == null ? "" : sortBy).trim()) {
            case "queueId", "submissionId" -> "id";
            case "contest" -> "contest_id";
            case "problem" -> "problem_id";
            case "user" -> "user_id";
            case "language" -> "language";
            case "status" -> "status";
            case "judgeServer" -> "judge_server";
            case "priority" -> "priority";
            case "startJudgeTime" -> "judge_start_time";
            case "finishTime" -> "judge_end_time";
            default -> "submit_time";
        };
        boolean asc = "asc".equalsIgnoreCase(sortOrder);
        wrapper.orderBy(true, asc, column);
    }

    private SubmissionQueueVO toVO(Submission submission, boolean includeLogs) {
        Contest contest = submission.contestId == null ? null : contestMapper.selectById(submission.contestId);
        ContestProblem contestProblem = submission.contestProblemId == null ? null : contestProblemMapper.selectById(submission.contestProblemId);
        Problem problem = problemMapper.selectById(submission.problemId);
        User user = userMapper.selectById(submission.userId);
        LocalDateTime submitAt = submitTime(submission);
        LocalDateTime startAt = submission.judgeStartTime;
        LocalDateTime finishAt = submission.judgeEndTime;
        long waitingTimeMillis = waitingDurationMillis(submitAt, startAt, finishAt, submission.status);
        long runningTimeMillis = runningDurationMillis(startAt, finishAt, submission.status);
        return new SubmissionQueueVO(
            submission.id,
            submission.id,
            submission.contestId,
            contest == null ? null : contest.title,
            submission.problemId,
            submission.contestProblemId,
            contestProblem == null ? null : contestProblem.label,
            firstNonBlank(contestProblem == null ? null : contestProblem.title, problem == null ? null : problem.title, String.valueOf(submission.problemId)),
            submission.userId,
            user == null ? null : user.username,
            user == null ? String.valueOf(submission.userId) : user.displayName,
            submission.language,
            submission.status,
            statusText(submission.status),
            submission.judgeServer,
            safeInt(submission.priority),
            submitAt,
            startAt,
            finishAt,
            waitingTimeMillis,
            runningTimeMillis,
            safeInt(submission.retryCount),
            includeLogs ? firstNonBlank(submission.errorMessage, submission.judgeMessage, null) : null
        );
    }

    private boolean canViewQueue(AuthUser authUser, Submission submission) {
        if (isSuperAdmin(authUser)) {
            return true;
        }
        if (submission.userId != null && submission.userId.equals(authUser.id())) {
            return true;
        }
        return isContestManager(authUser, submission);
    }

    private boolean canViewLogs(AuthUser authUser, Submission submission) {
        return isSuperAdmin(authUser) || isContestManager(authUser, submission);
    }

    private boolean canViewAllLogs(AuthUser authUser) {
        return isSuperAdmin(authUser);
    }

    private void ensureCanOperate(AuthUser authUser, Submission submission, Permission permission, String message) {
        boolean allowed = isSuperAdmin(authUser) || isContestManager(authUser, submission);
        if (!allowed) {
            auditLogger.logPermissionDenied(authUser, permission, "SubmissionQueue", submission.id, "无队列操作权限");
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), message);
        }
    }

    private boolean isContestManager(AuthUser authUser, Submission submission) {
        if (authUser == null || submission == null || submission.contestId == null) {
            return false;
        }
        Contest contest = contestMapper.selectById(submission.contestId);
        if (contest == null || contest.ownerId == null) {
            return false;
        }
        String ownerType = contest.ownerAccountType == null ? "USER" : contest.ownerAccountType;
        return contest.ownerId.equals(authUser.id())
            && ((authUser.adminAccount() && "ADMIN".equals(ownerType))
                || (!authUser.adminAccount() && "USER".equals(ownerType)));
    }

    private boolean isSuperAdmin(AuthUser authUser) {
        return authUser != null && "SUPER_ADMIN".equals(authUser.role());
    }

    private boolean isContestAdminRole(AuthUser authUser) {
        return authUser != null && "CLUB_ADMIN".equals(authUser.role());
    }

    private boolean isFinalStatus(String status) {
        String normalized = normalizeStatus(status);
        if (normalized == null) {
            return false;
        }
        return switch (normalized) {
            case "AC", "WA", "TLE", "MLE", "RE", "CE", "NOO", "SE", "FAILED" -> true;
            default -> false;
        };
    }

    private boolean isWaitingStatus(String status) {
        String normalized = normalizeStatus(status);
        return "WAITING".equals(normalized) || "PENDING".equals(normalized) || "REJUDGE_PENDING".equals(normalized);
    }

    private boolean isActiveStatus(String status) {
        String normalized = normalizeStatus(status);
        return "JUDGING".equals(normalized) || "COMPILING".equals(normalized) || "RUNNING".equals(normalized);
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        return switch (normalized) {
            case "WAITING" -> "WAITING";
            case "PENDING" -> "PENDING";
            case "JUDGING" -> "JUDGING";
            case "COMPILING" -> "COMPILING";
            case "RUNNING" -> "RUNNING";
            case "AC", "ACCEPTED" -> "AC";
            case "WA", "WRONG_ANSWER" -> "WA";
            case "TLE", "TIME_LIMIT_EXCEEDED" -> "TLE";
            case "MLE", "MEMORY_LIMIT_EXCEEDED" -> "MLE";
            case "RE", "RUNTIME_ERROR" -> "RE";
            case "CE", "COMPILE_ERROR", "COMPILATION_ERROR" -> "CE";
            case "SE", "SYSTEM_ERROR" -> "SE";
            case "REJUDGE_PENDING" -> "REJUDGE_PENDING";
            case "FAILED" -> "FAILED";
            default -> normalized;
        };
    }

    private String statusText(String status) {
        String normalized = normalizeStatus(status);
        if (normalized == null) {
            return "-";
        }
        return switch (normalized) {
            case "WAITING" -> "Waiting";
            case "PENDING" -> "Pending";
            case "JUDGING" -> "Judging";
            case "COMPILING" -> "Compiling";
            case "RUNNING" -> "Running";
            case "AC" -> "Accepted";
            case "WA" -> "Wrong Answer";
            case "TLE" -> "Time Limit Exceeded";
            case "MLE" -> "Memory Limit Exceeded";
            case "RE" -> "Runtime Error";
            case "CE" -> "Compile Error";
            case "SE" -> "System Error";
            case "REJUDGE_PENDING" -> "Rejudge Pending";
            case "FAILED" -> "Failed";
            default -> normalized;
        };
    }

    private String domjudgeProblemId(Submission submission) {
        if (submission.contestProblemId != null) {
            ContestProblem contestProblem = contestProblemMapper.selectById(submission.contestProblemId);
            if (contestProblem != null && contestProblem.domjudgeProblemId != null && !contestProblem.domjudgeProblemId.isBlank()) {
                return contestProblem.domjudgeProblemId;
            }
            return String.valueOf(submission.contestProblemId);
        }
        Problem problem = problemMapper.selectById(submission.problemId);
        if (problem != null && problem.domjudgeProblemId != null && !problem.domjudgeProblemId.isBlank()) {
            return problem.domjudgeProblemId;
        }
        return String.valueOf(submission.problemId);
    }

    private LocalDateTime submitTime(Submission submission) {
        return submission.submitTime == null ? submission.createdAt : submission.submitTime;
    }

    private Long durationMillis(LocalDateTime start, LocalDateTime end) {
        if (start == null || end == null || end.isBefore(start)) {
            return 0L;
        }
        return Duration.between(start, end).toMillis();
    }

    private Long waitingDurationMillis(LocalDateTime submitAt, LocalDateTime startAt, LocalDateTime finishAt, String status) {
        if (startAt != null) {
            return durationMillis(submitAt, startAt);
        }
        if (isWaitingStatus(status) || isActiveStatus(status)) {
            return durationMillis(submitAt, LocalDateTime.now());
        }
        return 0L;
    }

    private Long runningDurationMillis(LocalDateTime startAt, LocalDateTime finishAt, String status) {
        if (startAt == null) {
            return 0L;
        }
        LocalDateTime endAt = finishAt;
        if (endAt == null && isActiveStatus(status)) {
            endAt = LocalDateTime.now();
        }
        long duration = durationMillis(startAt, endAt);
        if (duration > MAX_REASONABLE_RUNNING_TIME_MILLIS) {
            return 0L;
        }
        return duration;
    }

    private Integer safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    /**
     * 获取判题队列统计数据
     */
    public java.util.Map<String, Object> stats(
        Long contestId,
        Long problemId,
        Long userId,
        String language,
        String judgeServer,
        LocalDateTime from,
        LocalDateTime to
    ) {
        AuthUser authUser = CurrentUser.get();
        if (authUser == null || !canViewAllStats(authUser)) {
            return basicStats();
        }

        long waiting = countForStats(authUser, contestId, problemId, userId, language, judgeServer, from, to,
            List.of("WAITING", "PENDING", "REJUDGE_PENDING"));
        long judging = countForStats(authUser, contestId, problemId, userId, language, judgeServer, from, to,
            List.of("JUDGING", "RUNNING", "COMPILING"));
        long finished = countForStats(authUser, contestId, problemId, userId, language, judgeServer, from, to,
            List.of("AC", "WA", "TLE", "MLE", "RE", "CE", "NOO", "SE", "FAILED"));
        long total = countForStats(authUser, contestId, problemId, userId, language, judgeServer, from, to, List.of());
        long maxConcurrent = settingService.getJudgeSettings().maxConcurrent;

        return java.util.Map.<String, Object>of(
            "waiting", waiting,
            "judging", judging,
            "finished", finished,
            "currentConcurrent", judging,
            "maxConcurrent", maxConcurrent,
            "total", total
        );
    }

    private long countForStats(
        AuthUser authUser,
        Long contestId,
        Long problemId,
        Long userId,
        String language,
        String judgeServer,
        LocalDateTime from,
        LocalDateTime to,
        List<String> statuses
    ) {
        QueryWrapper<Submission> wrapper = new QueryWrapper<>();
        applyVisibility(wrapper, authUser);
        applyFilters(wrapper, contestId, problemId, userId, language, null, judgeServer, from, to);
        if (statuses != null && !statuses.isEmpty()) {
            wrapper.in("status", statuses);
        }
        Long count = submissionMapper.selectCount(wrapper);
        return count == null ? 0 : count;
    }

    private java.util.Map<String, Object> basicStats() {
        return java.util.Map.of("message", "权限不足");
    }

    private boolean canViewAllStats(AuthUser authUser) {
        return isSuperAdmin(authUser) || isContestAdminRole(authUser);
    }
}

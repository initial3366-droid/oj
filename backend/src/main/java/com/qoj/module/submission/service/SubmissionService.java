/**
 * 提交服务 — 管理代码提交的完整生命周期。
 *
 * 核心职责：
 * - 提交创建：比赛/练习权限校验、频率限制、重复提交检测 → status=WAITING 等待调度
 * - 提交查询：多维度筛选（题目/比赛/语言/状态/用户/身份类型/时间范围）
 * - 权限控制：基于角色可见性（SUPER_ADMIN→全部 / TEACHER→管辖范围 / 普通用户→仅自己）
 * - 封榜逻辑：比赛封榜期间限制非管理员查看提交详情和代码
 * - 沙箱调试：通过当前判题服务运行自定义输入代码
 */
package com.qoj.module.submission.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.qoj.common.ErrorCode;
import com.qoj.common.PageResult;
import com.qoj.common.enums.SubmissionStatus;
import com.qoj.common.exception.BizException;
import com.qoj.common.redis.RedisKeys;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.entity.ContestRegistration;
import com.qoj.module.contest.service.ContestService;
import com.qoj.module.contest.entity.ContestProblem;
import com.qoj.module.contest.entity.ContestParticipant;
import com.qoj.module.contest.mapper.ContestProblemMapper;
import com.qoj.module.judge.JudgeService;
import com.qoj.module.judge.DockerJudgeService;
import com.qoj.module.judge.dto.DomjudgeSubmissionResponse;
import com.qoj.module.judge.service.DomjudgeAdapter;
import com.qoj.module.judge.service.LocalJudgeService;
import com.qoj.module.practice.entity.Practice;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.entity.ProblemTestCase;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.mapper.ProblemTestCaseMapper;
import com.qoj.module.classroom.entity.ClassMember;
import com.qoj.module.classroom.mapper.ClassMemberMapper;
import com.qoj.module.submission.dto.SandboxRunRequest;
import com.qoj.module.submission.dto.SubmissionCreateRequest;
import com.qoj.module.submission.entity.SandboxRun;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.entity.SubmissionCaseResult;
import com.qoj.module.submission.mapper.SandboxRunMapper;
import com.qoj.module.submission.mapper.SubmissionCaseResultMapper;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.submission.mapper.UserProblemStatusMapper;
import com.qoj.module.submission.vo.AdminSubmissionVO;
import com.qoj.module.submission.vo.SandboxRunVO;
import com.qoj.module.submission.vo.SubmissionCaseVO;
import com.qoj.module.submission.vo.SubmissionVO;
import com.qoj.module.setting.service.SystemSettingService;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.xcpcio.entity.ContestXcpcioSubmissionSync;
import com.qoj.module.xcpcio.mapper.ContestXcpcioSubmissionSyncMapper;
import com.qoj.module.user.service.UserScoreService;
import com.qoj.module.ws.JudgeMessagePublisher;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SubmissionService {
    private final SubmissionMapper submissionMapper;
    private final SubmissionCaseResultMapper submissionCaseResultMapper;
    private final SandboxRunMapper sandboxRunMapper;
    private final ProblemMapper problemMapper;
    private final ProblemTestCaseMapper problemTestCaseMapper;
    private final DomjudgeAdapter domjudgeAdapter;
    private final DockerJudgeService dockerJudgeService;
    private final LocalJudgeService localJudgeService;
    private final StringRedisTemplate redisTemplate;
    private final JudgeMessagePublisher judgeMessagePublisher;
    private final UserProblemStatusService userProblemStatusService;
    private final UserScoreService userScoreService;
    private final ContestService contestService;
    private final ContestProblemMapper contestProblemMapper;
    private final com.qoj.module.contest.mapper.ContestMapper contestMapper;
    private final UserMapper userMapper;
    private final com.qoj.module.user.mapper.ClubMemberMapper clubMemberMapper;
    private final ClassMemberMapper classMemberMapper;
    private final com.qoj.security.policy.SubmissionAccessPolicy submissionAccessPolicy;
    private final com.qoj.module.practice.mapper.PracticeMapper practiceMapper;
    private final com.qoj.module.practice.mapper.PracticeProblemMapper practiceProblemMapper;
    private final com.qoj.security.policy.PracticeAccessPolicy practiceAccessPolicy;
    private final com.qoj.security.policy.ContestAccessPolicy contestAccessPolicy;
    private final com.qoj.security.policy.ProblemAccessPolicy problemAccessPolicy;
    private final ContestXcpcioSubmissionSyncMapper xcpcioSubmissionSyncMapper;
    private final UserProblemStatusMapper userProblemStatusMapper;
    private final SystemSettingService settingService;

    public SubmissionService(
        SubmissionMapper submissionMapper,
        SubmissionCaseResultMapper submissionCaseResultMapper,
        SandboxRunMapper sandboxRunMapper,
        ProblemMapper problemMapper,
        ProblemTestCaseMapper problemTestCaseMapper,
        DomjudgeAdapter domjudgeAdapter,
        @Autowired(required = false) DockerJudgeService dockerJudgeService,
        @Autowired(required = false) LocalJudgeService localJudgeService,
        StringRedisTemplate redisTemplate,
        JudgeMessagePublisher judgeMessagePublisher,
        UserProblemStatusService userProblemStatusService,
        UserScoreService userScoreService,
        ContestService contestService,
        ContestProblemMapper contestProblemMapper,
        com.qoj.module.contest.mapper.ContestMapper contestMapper,
        UserMapper userMapper,
        com.qoj.module.user.mapper.ClubMemberMapper clubMemberMapper,
        ClassMemberMapper classMemberMapper,
        com.qoj.security.policy.SubmissionAccessPolicy submissionAccessPolicy,
        com.qoj.module.practice.mapper.PracticeMapper practiceMapper,
        com.qoj.module.practice.mapper.PracticeProblemMapper practiceProblemMapper,
        com.qoj.security.policy.PracticeAccessPolicy practiceAccessPolicy,
        com.qoj.security.policy.ContestAccessPolicy contestAccessPolicy,
        com.qoj.security.policy.ProblemAccessPolicy problemAccessPolicy,
        ContestXcpcioSubmissionSyncMapper xcpcioSubmissionSyncMapper,
        UserProblemStatusMapper userProblemStatusMapper,
        SystemSettingService settingService
    ) {
        this.submissionMapper = submissionMapper;
        this.submissionCaseResultMapper = submissionCaseResultMapper;
        this.sandboxRunMapper = sandboxRunMapper;
        this.problemMapper = problemMapper;
        this.problemTestCaseMapper = problemTestCaseMapper;
        this.domjudgeAdapter = domjudgeAdapter;
        this.dockerJudgeService = dockerJudgeService;
        this.localJudgeService = localJudgeService;
        this.redisTemplate = redisTemplate;
        this.judgeMessagePublisher = judgeMessagePublisher;
        this.userProblemStatusService = userProblemStatusService;
        this.userScoreService = userScoreService;
        this.contestService = contestService;
        this.contestProblemMapper = contestProblemMapper;
        this.contestMapper = contestMapper;
        this.userMapper = userMapper;
        this.clubMemberMapper = clubMemberMapper;
        this.classMemberMapper = classMemberMapper;
        this.submissionAccessPolicy = submissionAccessPolicy;
        this.practiceMapper = practiceMapper;
        this.practiceProblemMapper = practiceProblemMapper;
        this.practiceAccessPolicy = practiceAccessPolicy;
        this.contestAccessPolicy = contestAccessPolicy;
        this.problemAccessPolicy = problemAccessPolicy;
        this.xcpcioSubmissionSyncMapper = xcpcioSubmissionSyncMapper;
        this.userProblemStatusMapper = userProblemStatusMapper;
        this.settingService = settingService;
    }

    @Transactional
    public SubmissionVO submit(SubmissionCreateRequest request, String ip) {
        AuthUser user = CurrentUser.required();
        if (user.adminAccount()) {
            throw new BizException(403, "后台账号不能提交题目");
        }
        if (!settingService.isJudgeEnabled()) {
            throw new BizException(503, "判题服务已关闭，暂时无法提交");
        }
        LocalDateTime now = LocalDateTime.now();
        ContestRegistration contestRegistration = null;
        ContestProblem contestProblem = null;
        ContestParticipant contestParticipant = null;
        Contest contest = null;
        Problem problem = null;

        // 验证 Practice 提交
        if (request.practiceId() != null) {
            validatePracticeSubmission(request, user);
        }

        if (request.contestId() != null) {
            contestProblem = contestService.requireSubmittableContestProblem(request.contestId(), request.problemId(), user.id());
            contestRegistration = contestService.registrationForUser(request.contestId(), user.id());
            contestParticipant = contestService.participantForUser(request.contestId(), user.id());
            contest = contestMapper.selectById(request.contestId());
        } else {
            problem = problemMapper.selectById(request.problemId());
            if (problem == null) {
                throw new BizException(404, "题目不存在");
            }
            if (request.practiceId() == null && !problemAccessPolicy.can(user, com.qoj.security.policy.Permission.VIEW, problem)) {
                throw new BizException(404, "题目不存在");
            }
        }
        Long pendingProblemKey = contestProblem == null ? request.problemId() : contestProblem.id;
        String pendingKey = RedisKeys.judgePending(user.id(), pendingProblemKey, request.contestId());
        if (Boolean.TRUE.equals(redisTemplate.hasKey(pendingKey))) {
            throw new BizException(429, "重复提交过快");
        }
        String rateKey = RedisKeys.submitRate(ip == null ? "unknown" : ip);
        Long count = redisTemplate.opsForValue().increment(rateKey);
        redisTemplate.expire(rateKey, Duration.ofSeconds(60));
        if (count != null && count > 10) {
            throw new BizException(429, "提交频率过高");
        }
        Submission submission = new Submission();
        submission.userId = user.id();
        submission.problemId = contestProblem == null ? request.problemId() : contestProblem.problemId;
        submission.contestId = request.contestId();
        submission.contestProblemId = contestProblem == null ? null : contestProblem.id;
        submission.participantId = contestParticipant == null ? null : contestParticipant.id;
        submission.practiceId = request.practiceId();
        submission.code = request.code();
        submission.codeLength = request.code() == null ? 0 : request.code().length();
        submission.language = request.language();
        submission.status = SubmissionStatus.WAITING.name();
        submission.submitTime = now;
        submission.priority = 0;
        submission.retryCount = 0;
        submission.isContestSubmission = request.contestId() != null;
        submission.isFrozen = isFrozenContestSubmission(contest, now);
        submission.isRejudged = false;
        submission.judgeMessage = null;
        submission.errorMessage = null;
        submission.identityType = contestRegistration == null ? null : contestRegistration.identityType;
        submission.identityId = contestRegistration == null ? null : contestRegistration.identityId;
        submissionMapper.insert(submission);
        if (submission.contestId == null) {
            userScoreService.recompute(user.id());
            userProblemStatusService.recordSubmitted(submission);
        }
        redisTemplate.opsForValue().set(pendingKey, String.valueOf(submission.id), Duration.ofSeconds(60));

        // 提交已进入 WAITING 状态，由 JudgeQueueScheduler 调度判题
        judgeMessagePublisher.submissionCreated(submission.id);
        return detail(submission.id);
    }

    public PageResult<SubmissionVO> list(
        int page,
        int pageSize,
        Long problemId,
        Long contestId,
        String language,
        String status,
        Long userId
    ) {
        QueryWrapper<Submission> wrapper = new QueryWrapper<>();
        selectAdminListColumns(wrapper);
        if (userId != null) {
            wrapper.eq("user_id", userId);
        }
        if (contestId != null) {
            wrapper.eq("contest_id", contestId);
            if (problemId != null) {
                wrapper.eq("contest_problem_id", problemId);
            }
        } else if (problemId != null) {
            wrapper.eq("problem_id", problemId);
            wrapper.isNull("contest_id");
        }
        if (language != null && !language.isBlank()) {
            wrapper.eq("language", language);
        }
        if (status != null && !status.isBlank()) {
            wrapper.eq("status", status);
        }
        wrapper.orderByDesc("created_at");
        Page<Submission> result = submissionMapper.selectPage(Page.of(page, pageSize), wrapper);
        return new PageResult<>(result.getTotal(), result.getRecords().stream().map(item -> toVO(item, false, false)).toList());
    }

    public PageResult<AdminSubmissionVO> adminList(
        int page,
        int pageSize,
        Long id,
        Long userId,
        Long classId,
        Long problemId,
        Long contestId,
        Long contestProblemId,
        Long practiceId,
        String language,
        String status,
        String judgeServer,
        String identityType,
        LocalDateTime from,
        LocalDateTime to,
        String sortBy,
        String sortOrder
    ) {
        AuthUser authUser = CurrentUser.required();
        QueryWrapper<Submission> wrapper = new QueryWrapper<>();
        selectAdminListColumns(wrapper);
        applyAdminFilters(wrapper, authUser, id, userId, classId, problemId, contestId,
            contestProblemId, practiceId, language, status, judgeServer, identityType, from, to);
        applyAdminSorting(wrapper, sortBy, sortOrder);
        Page<Submission> result = submissionMapper.selectPage(Page.of(page, pageSize), wrapper);
        return new PageResult<>(
            result.getTotal(),
            result.getRecords().stream().map(item -> toAdminVO(item, false, false)).toList()
        );
    }

    /**
     * 管理端提交查询的公共过滤逻辑（adminList 与导出共用）。
     */
    private void applyAdminFilters(
        QueryWrapper<Submission> wrapper,
        AuthUser authUser,
        Long id,
        Long userId,
        Long classId,
        Long problemId,
        Long contestId,
        Long contestProblemId,
        Long practiceId,
        String language,
        String status,
        String judgeServer,
        String identityType,
        LocalDateTime from,
        LocalDateTime to
    ) {
        if (contestId != null) {
            if ("TEACHER".equals(authUser.role())) {
                applyVisibility(wrapper, authUser, userId);
            } else {
                ensureCanManageContest(authUser, contestId);
                if (userId != null) {
                    wrapper.eq("user_id", userId);
                }
            }
        } else {
            applyVisibility(wrapper, authUser, userId);
        }
        if (id != null) {
            wrapper.eq("id", id);
        }
        if (problemId != null) {
            wrapper.eq("problem_id", problemId);
        }
        if (contestId != null) {
            wrapper.eq("contest_id", contestId);
        }
        if (contestProblemId != null) {
            wrapper.eq("contest_problem_id", contestProblemId);
        }
        if (practiceId != null) {
            wrapper.eq("practice_id", practiceId);
        }
        // 按班级筛选：取该班级全部成员的 user_id（来源 class_members 表）
        if (classId != null) {
            wrapper.inSql(
                "user_id",
                "SELECT user_id FROM class_members WHERE class_id = " + classId
            );
        }
        if (language != null && !language.isBlank()) {
            wrapper.eq("language", language.trim());
        }
        if (status != null && !status.isBlank()) {
            wrapper.eq("status", status.trim());
        }
        if (judgeServer != null && !judgeServer.isBlank()) {
            wrapper.eq("judge_server", judgeServer.trim());
        }
        if (identityType != null && !identityType.isBlank()) {
            wrapper.eq("identity_type", identityType.trim());
        }
        if (from != null) {
            wrapper.ge("submit_time", from);
        }
        if (to != null) {
            wrapper.le("submit_time", to);
        }
    }

    /**
     * 管理端导出：按当前过滤条件拉取全量提交（不分页，最多 limit 条），用于 CSV 导出。
     */
    public List<AdminSubmissionVO> adminExportList(
        int limit,
        Long id,
        Long userId,
        Long classId,
        Long problemId,
        Long contestId,
        Long contestProblemId,
        Long practiceId,
        String language,
        String status,
        String judgeServer,
        String identityType,
        LocalDateTime from,
        LocalDateTime to,
        String sortBy,
        String sortOrder
    ) {
        AuthUser authUser = CurrentUser.required();
        QueryWrapper<Submission> wrapper = new QueryWrapper<>();
        selectAdminListColumns(wrapper);
        applyAdminFilters(wrapper, authUser, id, userId, classId, problemId, contestId,
            contestProblemId, practiceId, language, status, judgeServer, identityType, from, to);
        applyAdminSorting(wrapper, sortBy, sortOrder);
        wrapper.last("LIMIT " + Math.max(1, limit));
        List<Submission> submissions = submissionMapper.selectList(wrapper);
        return submissions.stream().map(item -> toAdminVO(item, false, false)).toList();
    }

    public AdminSubmissionVO adminDetail(long id) {
        Submission submission = requireSubmission(id);
        ensureAdminCanViewSubmission(CurrentUser.required(), submission);
        return toAdminVO(submission, true, true);
    }

    public SubmissionVO detail(long id) {
        Submission submission = requireSubmission(id);
        AuthUser authUser = CurrentUser.required();

        if (!canViewSubmissionDetail(authUser, submission)) {
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无权限查看该提交代码");
        }

        return toVO(submission, canViewSubmissionCode(authUser, submission), true);
    }

    public String code(long id) {
        Submission submission = requireSubmission(id);
        AuthUser authUser = CurrentUser.required();
        if (!canViewSubmissionCode(authUser, submission)) {
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无权限查看该提交代码");
        }
        return submission.code;
    }

    public String adminCode(long id) {
        Submission submission = requireSubmission(id);
        ensureAdminCanViewSubmission(CurrentUser.required(), submission);
        return submission.code;
    }

    @Transactional
    public void adminDelete(long id) {
        Submission submission = requireSubmission(id);
        ensureAdminCanViewSubmission(CurrentUser.required(), submission);
        userProblemStatusMapper.clearLastSubmission(submission.id);
        submissionCaseResultMapper.delete(new QueryWrapper<SubmissionCaseResult>().eq("submission_id", submission.id));
        xcpcioSubmissionSyncMapper.delete(new QueryWrapper<ContestXcpcioSubmissionSync>().eq("submission_id", submission.id));
        submissionMapper.deleteById(submission.id);
        if (submission.contestId == null) {
            userScoreService.recompute(submission.userId);
            userProblemStatusService.recompute(submission.userId, submission.problemId);
        }
        judgeMessagePublisher.submissionQueueUpdated();
    }

    @Transactional
    public SandboxRunVO sandboxRun(SandboxRunRequest request) {
        if (CurrentUser.required().adminAccount()) {
            throw new BizException(403, "后台账号不能调试题目");
        }
        if (!settingService.isJudgeEnabled()) {
            throw new BizException(503, "判题服务已关闭，暂时无法调试");
        }
        var judgeSettings = settingService.getJudgeSettings();
        if (!judgeSettings.enableSandbox) {
            throw new BizException(503, "沙箱调试功能未启用");
        }
        if (!hasSandboxJudgeService(judgeSettings.mode)) {
            throw new BizException(503, "沙箱调试功能未启用，请联系管理员开启 Docker 或本地判题");
        }
        SandboxRun run = new SandboxRun();
        run.userId = CurrentUser.id();
        run.code = request.code();
        run.language = request.language();
        run.input = request.input();
        SandboxRunResult result = runSandbox(judgeSettings.mode, request);
        run.output = result.output().isBlank() ? result.error() : result.output();
        run.status = result.status();
        run.runAt = LocalDateTime.now();
        sandboxRunMapper.insert(run);
        return new SandboxRunVO(run.id, run.output, run.status, run.runAt);
    }

    private boolean hasSandboxJudgeService(String mode) {
        if ("docker".equalsIgnoreCase(mode)) {
            return dockerJudgeService != null;
        }
        if ("unsafe-local".equalsIgnoreCase(mode)) {
            return localJudgeService != null;
        }
        return false;
    }

    private SandboxRunResult runSandbox(String mode, SandboxRunRequest request) {
        if ("docker".equalsIgnoreCase(mode)) {
            JudgeService.SandboxResult result = dockerJudgeService.runCustom(
                request.language(), request.code(), request.input(), 2000, 256);
            return new SandboxRunResult(result.output(), result.error(), result.status());
        }
        if ("unsafe-local".equalsIgnoreCase(mode)) {
            var judgeSettings = settingService.getJudgeSettings();
            if (!judgeSettings.enableUnsafeLocalJudge) {
                throw new BizException(503, "本地判题未启用，请联系管理员开启 Docker 判题模式");
            }
            LocalJudgeService.SandboxResult result = localJudgeService.runCustom(
                request.language(), request.code(), request.input(), 2000, 256);
            return new SandboxRunResult(result.output(), result.error(), result.status());
        }
        throw new BizException(503, "当前判题模式不支持沙箱调试，请使用 docker 模式");
    }

    private record SandboxRunResult(String output, String error, String status) {
    }

    private Submission requireSubmission(long id) {
        Submission submission = submissionMapper.selectById(id);
        if (submission == null) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "提交不存在");
        }
        return submission;
    }

    private void selectAdminListColumns(QueryWrapper<Submission> wrapper) {
        wrapper.select(
            "id",
            "user_id",
            "problem_id",
            "contest_id",
            "contest_problem_id",
            "participant_id",
            "team_id",
            "practice_id",
            "code_length",
            "language",
            "status",
            "score",
            "time_used",
            "memory_used",
            "submit_time",
            "judge_start_time",
            "judge_end_time",
            "is_contest_submission",
            "is_frozen",
            "is_rejudged",
            "judge_message",
            "identity_type",
            "identity_id",
            "domjudge_submission_id",
            "judge_server",
            "priority",
            "retry_count",
            "error_message",
            "created_at",
            "updated_at"
        );
    }

    private void applyAdminSorting(QueryWrapper<Submission> wrapper, String sortBy, String sortOrder) {
        String column = switch ((sortBy == null ? "" : sortBy).trim()) {
            case "id" -> "id";
            case "userId" -> "user_id";
            case "problemId" -> "problem_id";
            case "contestId" -> "contest_id";
            case "contestProblemId" -> "contest_problem_id";
            case "practiceId" -> "practice_id";
            case "language" -> "language";
            case "status" -> "status";
            case "score" -> "score";
            case "timeUsed" -> "time_used";
            case "memoryUsed" -> "memory_used";
            case "judgeServer" -> "judge_server";
            case "priority" -> "priority";
            case "retryCount" -> "retry_count";
            case "judgeStartTime" -> "judge_start_time";
            case "judgeEndTime" -> "judge_end_time";
            case "createdAt" -> "created_at";
            case "updatedAt" -> "updated_at";
            default -> "submit_time";
        };
        boolean asc = "asc".equalsIgnoreCase(sortOrder);
        wrapper.orderBy(true, asc, column);
    }

    private void ensureAdminCanViewSubmission(AuthUser authUser, Submission submission) {
        if (authUser == null || (!authUser.adminAccount() && !"TEACHER".equals(authUser.role()))) {
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无权查看该提交");
        }
        if ("SUPER_ADMIN".equals(authUser.role())) {
            return;
        }
        if (isContestManager(authUser, submission)) {
            return;
        }
        QueryWrapper<Submission> wrapper = new QueryWrapper<>();
        wrapper.eq("id", submission.id);
        applyVisibility(wrapper, authUser, null);
        Long count = submissionMapper.selectCount(wrapper);
        if (count == null || count == 0) {
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无权查看该提交");
        }
    }

    private void applyVisibility(QueryWrapper<Submission> wrapper, AuthUser authUser, Long userId) {
        if ("SUPER_ADMIN".equals(authUser.role())) {
            if (userId != null) {
                wrapper.eq("user_id", userId);
            }
            return;
        }
        if (authUser.adminAccount()) {
            if (userId != null) {
                wrapper.eq("user_id", userId);
            }
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
        if ("CLUB_ADMIN".equals(authUser.role())) {
            if (userId != null) {
                wrapper.eq("user_id", userId);
            }
            wrapper.inSql(
                "user_id",
                "SELECT cm.user_id FROM club_members cm WHERE cm.club_id IN "
                    + "(SELECT club_id FROM club_members WHERE user_id = " + authUser.id() + " AND role = 'ADMIN')"
            );
            return;
        }
        if ("TEACHER".equals(authUser.role())) {
            if (userId != null) {
                wrapper.eq("user_id", userId);
            }
            wrapper.inSql(
                "user_id",
                "SELECT cm.user_id FROM class_members cm WHERE cm.class_id IN "
                    + "(SELECT id FROM classes WHERE teacher_id = " + authUser.id() + ")"
            );
            return;
        }
        wrapper.eq("user_id", authUser.id());
    }

    private void ensureCanManageContest(AuthUser authUser, Long contestId) {
        if (authUser == null || (!authUser.adminAccount() && !"TEACHER".equals(authUser.role()))) {
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无权查看该比赛提交");
        }
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "比赛不存在");
        }
        if (!contestAccessPolicy.can(authUser, com.qoj.security.policy.Permission.MANAGE_SCOREBOARD, contest)) {
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无权查看该比赛提交");
        }
    }

    private AdminSubmissionVO toAdminVO(Submission submission, boolean includeCode, boolean includeCases) {
        User user = submission.userId == null ? null : userMapper.selectById(submission.userId);
        Contest contest = submission.contestId == null ? null : contestMapper.selectById(submission.contestId);
        ContestProblem contestProblem = submission.contestProblemId == null ? null : contestProblemMapper.selectById(submission.contestProblemId);
        Practice practice = submission.practiceId == null ? null : practiceMapper.selectById(submission.practiceId);
        Problem problem = submission.problemId == null ? null : problemMapper.selectById(submission.problemId);
        Integer codeLength = submission.codeLength;
        if (codeLength == null && includeCode && submission.code != null) {
            codeLength = submission.code.length();
        }
        QueryWrapper<SubmissionCaseResult> caseWrapper = new QueryWrapper<SubmissionCaseResult>().eq("submission_id", submission.id);
        long totalCaseCount = submissionCaseResultMapper.selectCount(caseWrapper);
        long passedCaseCount = submissionCaseResultMapper.selectCount(
            new QueryWrapper<SubmissionCaseResult>()
                .eq("submission_id", submission.id)
                .eq("status", SubmissionStatus.AC.name())
        );
        Map<Integer, ProblemTestCase> testCaseMap = includeCases ? buildTestCaseMap(submission.problemId) : Map.of();
        List<SubmissionCaseVO> cases = includeCases
            ? submissionCaseResultMapper
                .selectList(new QueryWrapper<SubmissionCaseResult>().eq("submission_id", submission.id).orderByAsc("case_no"))
                .stream()
                .map(item -> toCaseVO(item, testCaseMap))
                .toList()
            : List.of();
        return new AdminSubmissionVO(
            submission.id,
            submission.userId,
            user == null ? null : user.username,
            user == null ? null : user.displayName,
            submission.problemId,
            firstNonBlank(contestProblem == null ? null : contestProblem.title, problem == null ? null : problem.title, String.valueOf(submission.problemId)),
            submission.contestId,
            contest == null ? null : contest.title,
            submission.contestProblemId,
            contestProblem == null ? null : contestProblem.label,
            submission.practiceId,
            practice == null ? null : practice.title,
            submission.participantId,
            submission.teamId,
            codeLength,
            submission.language,
            submission.status,
            submission.score,
            submission.timeUsed,
            submission.memoryUsed,
            submission.identityType,
            submission.identityId,
            submission.domjudgeSubmissionId,
            submission.judgeServer,
            submission.priority,
            submission.retryCount,
            submission.judgeMessage,
            submission.errorMessage,
            submission.submitTime == null ? submission.createdAt : submission.submitTime,
            submission.judgeStartTime,
            submission.judgeEndTime,
            submission.isContestSubmission,
            submission.isFrozen,
            submission.isRejudged,
            submission.createdAt,
            submission.updatedAt,
            Math.toIntExact(passedCaseCount),
            Math.toIntExact(totalCaseCount),
            includeCode ? submission.code : null,
            cases
        );
    }

    private SubmissionVO toVO(Submission submission, boolean includeCode, boolean includeCases) {
        QueryWrapper<SubmissionCaseResult> caseWrapper = new QueryWrapper<SubmissionCaseResult>().eq("submission_id", submission.id);
        long totalCaseCount = submissionCaseResultMapper.selectCount(caseWrapper);
        long passedCaseCount = submissionCaseResultMapper.selectCount(
            new QueryWrapper<SubmissionCaseResult>()
                .eq("submission_id", submission.id)
                .eq("status", SubmissionStatus.AC.name())
        );
        Map<Integer, ProblemTestCase> testCaseMap = includeCases ? buildTestCaseMap(submission.problemId) : Map.of();
        List<SubmissionCaseVO> cases = includeCases
            ? submissionCaseResultMapper
                .selectList(new QueryWrapper<SubmissionCaseResult>().eq("submission_id", submission.id).orderByAsc("case_no"))
                .stream()
                .map(item -> toCaseVO(item, testCaseMap))
                .toList()
            : List.of();
        return new SubmissionVO(
            submission.id,
            submission.userId,
            submission.problemId,
            problemTitle(submission),
            submission.contestId,
            submission.practiceId,
            submission.language,
            submission.status,
            submission.timeUsed,
            submission.memoryUsed,
            submission.identityType,
            submission.identityId,
            submission.domjudgeSubmissionId,
            submission.submitTime == null ? submission.createdAt : submission.submitTime,
            submission.createdAt,
            Math.toIntExact(passedCaseCount),
            Math.toIntExact(totalCaseCount),
            includeCode ? submission.code : null,
            cases
        );
    }

    private String problemTitle(Submission submission) {
        if (submission.contestProblemId != null) {
            ContestProblem contestProblem = contestProblemMapper.selectById(submission.contestProblemId);
            if (contestProblem != null) {
                return contestProblem.title;
            }
        }
        Problem problem = problemMapper.selectById(submission.problemId);
        return problem == null ? String.valueOf(submission.problemId) : problem.title;
    }

    private SubmissionCaseVO toCaseVO(SubmissionCaseResult item, Map<Integer, ProblemTestCase> testCaseMap) {
        String inputPreview = item.inputPreview;
        String outputPreview = item.outputPreview;
        String expectedPreview = item.expectedPreview;
        if (testCaseMap != null) {
            ProblemTestCase tc = testCaseMap.get(item.caseNo);
            if (tc != null) {
                if (inputPreview == null || inputPreview.isBlank()) {
                    inputPreview = preview(tc.inputData);
                }
                if (outputPreview == null || outputPreview.isBlank()) {
                    outputPreview = preview(tc.outputData);
                }
                if (expectedPreview == null || expectedPreview.isBlank()) {
                    expectedPreview = preview(tc.outputData);
                }
            }
        }
        return new SubmissionCaseVO(
            item.id,
            item.submissionId,
            item.caseNo,
            item.subtaskNo,
            item.status,
            item.score,
            item.maxScore,
            item.timeUsed,
            item.memoryUsed,
            inputPreview,
            outputPreview,
            expectedPreview,
            item.judgeMessage
        );
    }

    private Map<Integer, ProblemTestCase> buildTestCaseMap(Long problemId) {
        Map<Integer, ProblemTestCase> map = new HashMap<>();
        if (problemId != null) {
            for (ProblemTestCase tc : problemTestCaseMapper.selectByProblemId(problemId)) {
                map.put(tc.caseNo, tc);
            }
        }
        return map;
    }

    private String preview(String text) {
        if (text == null) return null;
        return text.length() > 200 ? text.substring(0, 200) + "..." : text;
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

    private boolean isFrozenContestSubmission(Contest contest, LocalDateTime submittedAt) {
        return contest != null
            && submittedAt != null
            && Boolean.TRUE.equals(contest.frozen)
            && contest.freezeTime != null
            && contest.endTime != null
            && !submittedAt.isBefore(contest.freezeTime)
            && submittedAt.isBefore(contest.endTime);
    }

    private boolean canViewSubmissionDetail(AuthUser authUser, Submission submission) {
        return submissionAccessPolicy.can(authUser, com.qoj.security.policy.Permission.VIEW, submission)
            || isContestManager(authUser, submission);
    }

    private boolean canViewSubmissionCode(AuthUser authUser, Submission submission) {
        return submissionAccessPolicy.canViewCode(authUser, submission)
            || isContestManager(authUser, submission);
    }

    private boolean isContestManager(AuthUser authUser, Submission submission) {
        if (authUser == null || submission == null || submission.contestId == null) {
            return false;
        }
        if ("SUPER_ADMIN".equals(authUser.role())) {
            return true;
        }
        com.qoj.module.contest.entity.Contest contest = contestMapper.selectById(submission.contestId);
        if (contest == null || contest.ownerId == null) {
            return false;
        }
        String ownerType = contest.ownerAccountType == null ? "USER" : contest.ownerAccountType;
        return contest.ownerId.equals(authUser.id())
            && ((authUser.adminAccount() && "ADMIN".equals(ownerType))
                || (!authUser.adminAccount() && "USER".equals(ownerType)));
    }

    /**
     * 验证 Practice 提交的合法性
     */
    private void validatePracticeSubmission(SubmissionCreateRequest request, AuthUser user) {
        // 1. 验证 practice 是否存在
        com.qoj.module.practice.entity.Practice practice = practiceMapper.selectById(request.practiceId());
        if (practice == null) {
            throw new BizException(ErrorCode.NOT_FOUND, "练习不存在");
        }

        // 2. 验证 practice 是否已发布
        if (!Boolean.TRUE.equals(practice.published)) {
            throw new BizException(ErrorCode.FORBIDDEN, "练习未发布");
        }

        // 3. 验证 audience 权限。PracticeAccessPolicy 对非公开题单会先拒绝，
        // 班级题单需要在这里按成员关系放行。
        if (!"ALL".equals(practice.audience)) {
            validatePracticeAudience(practice, user);
        }

        // 4. 验证 problem 是否属于 practice
        Long problemInPracticeCount = practiceProblemMapper.selectCount(
            new QueryWrapper<com.qoj.module.practice.entity.PracticeProblem>()
                .eq("practice_id", request.practiceId())
                .eq("problem_id", request.problemId())
        );
        if (problemInPracticeCount == null || problemInPracticeCount == 0) {
            throw new BizException(ErrorCode.BAD_REQUEST, "该题目不属于该练习");
        }
    }

    /**
     * 验证 Practice 的 audience 权限
     */
    private void validatePracticeAudience(com.qoj.module.practice.entity.Practice practice, AuthUser user) {
        // 超级管理员和创建者跳过检查
        if ("SUPER_ADMIN".equals(user.role()) || practice.ownerId.equals(user.id())) {
            return;
        }

        if ("CLUB".equals(practice.audience) && practice.audienceId != null) {
            Long memberCount = clubMemberMapper.selectCount(
                new QueryWrapper<com.qoj.module.user.entity.ClubMember>()
                    .eq("club_id", practice.audienceId)
                    .eq("user_id", user.id())
            );
            if (memberCount == null || memberCount == 0) {
                throw new BizException(ErrorCode.FORBIDDEN, "该练习仅限指定社团成员");
            }
        }
        if ("CLASS".equals(practice.audience) && practice.audienceId != null) {
            User entity = userMapper.selectById(user.id());
            if (entity != null && practice.audienceId.equals(entity.classId)) {
                return;
            }
            Long memberCount = classMemberMapper.selectCount(
                new QueryWrapper<ClassMember>()
                    .eq("class_id", practice.audienceId)
                    .eq("user_id", user.id())
            );
            if (memberCount == null || memberCount == 0) {
                throw new BizException(ErrorCode.FORBIDDEN, "该题单仅限指定班级成员");
            }
        }
    }
}

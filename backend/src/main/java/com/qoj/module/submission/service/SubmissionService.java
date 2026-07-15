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
import com.qoj.common.enums.JudgeBackend;
import com.qoj.common.enums.SubmissionStatus;
import com.qoj.common.exception.BizException;
import com.qoj.common.redis.RedisKeys;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.entity.ContestRegistration;
import com.qoj.module.contest.service.ContestService;
import com.qoj.module.contest.entity.ContestProblem;
import com.qoj.module.contest.entity.ContestParticipant;
import com.qoj.module.contest.entity.ContestProblemTestCase;
import com.qoj.module.contest.mapper.ContestProblemMapper;
import com.qoj.module.contest.mapper.ContestProblemTestCaseMapper;
import com.qoj.module.judge.JudgeService;
import com.qoj.module.judge.gojudge.GoJudgeService;
import com.qoj.module.practice.entity.Practice;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.entity.ProblemTestCase;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.mapper.ProblemTestCaseMapper;
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
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 提交业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class SubmissionService {
    private final SubmissionMapper submissionMapper;
    private final SubmissionCaseResultMapper submissionCaseResultMapper;
    private final SandboxRunMapper sandboxRunMapper;
    private final ProblemMapper problemMapper;
    private final ProblemTestCaseMapper problemTestCaseMapper;
    private final GoJudgeService goJudgeService;
    private final SandboxExecutionGuard sandboxExecutionGuard;
    private final StringRedisTemplate redisTemplate;
    private final JudgeMessagePublisher judgeMessagePublisher;
    private final UserProblemStatusService userProblemStatusService;
    private final UserScoreService userScoreService;
    private final ContestService contestService;
    private final ContestProblemMapper contestProblemMapper;
    private final ContestProblemTestCaseMapper contestProblemTestCaseMapper;
    private final com.qoj.module.contest.mapper.ContestMapper contestMapper;
    private final UserMapper userMapper;
    private final com.qoj.security.policy.SubmissionAccessPolicy submissionAccessPolicy;
    private final com.qoj.module.practice.mapper.PracticeMapper practiceMapper;
    private final com.qoj.module.practice.mapper.PracticeProblemMapper practiceProblemMapper;
    private final com.qoj.security.policy.PracticeAccessPolicy practiceAccessPolicy;
    private final com.qoj.security.policy.ContestAccessPolicy contestAccessPolicy;
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_EXPORT_LIMIT = 10000;
    private static final int MAX_SANDBOX_OUTPUT_BYTES = 60 * 1024;
    private static final String SANDBOX_OUTPUT_TRUNCATED = "\n... (truncated)";

    private final com.qoj.security.policy.ProblemAccessPolicy problemAccessPolicy;
    private final ContestXcpcioSubmissionSyncMapper xcpcioSubmissionSyncMapper;
    private final UserProblemStatusMapper userProblemStatusMapper;
    private final SystemSettingService settingService;
    private final com.qoj.module.practice.service.PracticePublicationService practicePublicationService;

    public SubmissionService(
        SubmissionMapper submissionMapper,
        SubmissionCaseResultMapper submissionCaseResultMapper,
        SandboxRunMapper sandboxRunMapper,
        ProblemMapper problemMapper,
        ProblemTestCaseMapper problemTestCaseMapper,
        GoJudgeService goJudgeService,
        SandboxExecutionGuard sandboxExecutionGuard,
        StringRedisTemplate redisTemplate,
        JudgeMessagePublisher judgeMessagePublisher,
        UserProblemStatusService userProblemStatusService,
        UserScoreService userScoreService,
        ContestService contestService,
        ContestProblemMapper contestProblemMapper,
        ContestProblemTestCaseMapper contestProblemTestCaseMapper,
        com.qoj.module.contest.mapper.ContestMapper contestMapper,
        UserMapper userMapper,
        com.qoj.security.policy.SubmissionAccessPolicy submissionAccessPolicy,
        com.qoj.module.practice.mapper.PracticeMapper practiceMapper,
        com.qoj.module.practice.mapper.PracticeProblemMapper practiceProblemMapper,
        com.qoj.security.policy.PracticeAccessPolicy practiceAccessPolicy,
        com.qoj.security.policy.ContestAccessPolicy contestAccessPolicy,
        com.qoj.security.policy.ProblemAccessPolicy problemAccessPolicy,
        ContestXcpcioSubmissionSyncMapper xcpcioSubmissionSyncMapper,
        UserProblemStatusMapper userProblemStatusMapper,
        SystemSettingService settingService,
        com.qoj.module.practice.service.PracticePublicationService practicePublicationService
    ) {
        this.submissionMapper = submissionMapper;
        this.submissionCaseResultMapper = submissionCaseResultMapper;
        this.sandboxRunMapper = sandboxRunMapper;
        this.problemMapper = problemMapper;
        this.problemTestCaseMapper = problemTestCaseMapper;
        this.goJudgeService = goJudgeService;
        this.sandboxExecutionGuard = sandboxExecutionGuard;
        this.redisTemplate = redisTemplate;
        this.judgeMessagePublisher = judgeMessagePublisher;
        this.userProblemStatusService = userProblemStatusService;
        this.userScoreService = userScoreService;
        this.contestService = contestService;
        this.contestProblemMapper = contestProblemMapper;
        this.contestProblemTestCaseMapper = contestProblemTestCaseMapper;
        this.contestMapper = contestMapper;
        this.userMapper = userMapper;
        this.submissionAccessPolicy = submissionAccessPolicy;
        this.practiceMapper = practiceMapper;
        this.practiceProblemMapper = practiceProblemMapper;
        this.practiceAccessPolicy = practiceAccessPolicy;
        this.contestAccessPolicy = contestAccessPolicy;
        this.problemAccessPolicy = problemAccessPolicy;
        this.xcpcioSubmissionSyncMapper = xcpcioSubmissionSyncMapper;
        this.userProblemStatusMapper = userProblemStatusMapper;
        this.settingService = settingService;
        this.practicePublicationService = practicePublicationService;
    }

    /**
     * 创建或提交目标数据。调用前会结合当前登录身份执行权限判断；不满足业务约束时直接抛出明确异常；执行持久化写入；读写 Redis 中的缓存、锁或限流状态；在状态变化后发布异步消息；可能调用外部判题或网关服务；结果依赖当前时间；整个过程位于同一数据库事务中。
     */
    @Transactional
    public SubmissionVO submit(SubmissionCreateRequest request, String ip) {
        AuthUser user = CurrentUser.required();
        if (!"USER".equals(user.accountType())) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(403, "仅学生账号可以提交题目");
        }
        if (!goJudgeService.supportsLanguage(request.language())) {
            // Both go-judge and CCPCOJ expose the same fixed language allowlist.
            throw new BizException(ErrorCode.BAD_REQUEST, "不支持的编程语言");
        }
        if (request.contestId() != null && request.practiceId() != null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, "比赛提交与练习提交不能同时指定");
        }
        LocalDateTime now = LocalDateTime.now();
        ContestRegistration contestRegistration = null;
        ContestProblem contestProblem = null;
        ContestParticipant contestParticipant = null;
        Contest contest = null;
        Problem problem = null;

        if (request.contestId() != null) {
            // Lock before any contest validation reads. This pairs with contest
            // updates so the snapshot and all submit-time checks use one mode.
            contest = contestMapper.selectByIdForUpdate(request.contestId());
            if (contest == null) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(ErrorCode.NOT_FOUND, "比赛不存在");
            }
            contestProblem = contestService.requireSubmittableContestProblem(request.contestId(), request.problemId(), user.id());
            contestRegistration = contestService.registrationForUser(request.contestId(), user.id());
            contestParticipant = contestService.participantForUser(request.contestId(), user.id());
        } else {
            // Practice and ordinary problems always use the embedded go-judge path.
            if (request.practiceId() != null) {
                validatePracticeSubmission(request, user);
            }
            problem = problemMapper.selectById(request.problemId());
            if (problem == null) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(404, "题目不存在");
            }
            if (request.practiceId() == null && !problemAccessPolicy.can(user, com.qoj.security.policy.Permission.VIEW, problem)) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(404, "题目不存在");
            }
        }
        if (!settingService.isJudgeEnabled()) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(503, "判题服务已关闭，暂时无法提交");
        }
        Long pendingProblemKey = contestProblem == null ? request.problemId() : contestProblem.id;
        String pendingKey = RedisKeys.judgePending(user.id(), pendingProblemKey, request.contestId());
        if (Boolean.TRUE.equals(redisTemplate.hasKey(pendingKey))) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(429, "重复提交过快");
        }
        String rateKey = RedisKeys.submitRate(ip == null ? "unknown" : ip);
        Long count = redisTemplate.opsForValue().increment(rateKey);
        redisTemplate.expire(rateKey, Duration.ofSeconds(60));
        if (count != null && count > 10) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(429, "提交频率过高");
        }
        Submission submission = new Submission();
        submission.userId = user.id();
        submission.problemId = contestProblem == null ? request.problemId() : contestProblem.problemId;
        submission.contestId = request.contestId();
        submission.contestProblemId = contestProblem == null ? null : contestProblem.id;
        submission.participantId = contestParticipant == null ? null : contestParticipant.id;
        submission.practicePublicationId = request.practiceId();
        submission.practiceId = request.practiceId() == null
            ? null
            : practicePublicationService.sourcePracticeId(request.practiceId());
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
        submission.judgeBackend = contest == null
            ? JudgeBackend.GO_JUDGE.name()
            : JudgeBackend.fromStored(contest.judgeMode, JudgeBackend.GO_JUDGE).name();
        submission.identityType = contestRegistration == null ? null : contestRegistration.identityType;
        submission.identityId = contestRegistration == null ? null : contestRegistration.identityId;
        submissionMapper.insert(submission);
        if (submission.contestId == null) {
            userScoreService.recompute(user.id());
            userProblemStatusService.recordSubmitted(submission);
        }
        redisTemplate.opsForValue().set(pendingKey, String.valueOf(submission.id), Duration.ofSeconds(5));

        // 提交已进入 WAITING 状态，由 JudgeQueueScheduler 调度判题
        judgeMessagePublisher.submissionCreated(submission.id);
        /**
         * 封装详情相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return detail(submission.id);
    }

    /**
     * 查询目标数据列表。调用前会结合当前登录身份执行权限判断；从持久化层读取数据；结果依赖当前时间；返回结果包含分页边界。
     */
    public PageResult<SubmissionVO> list(
        int page,
        int pageSize,
        Long problemId,
        Long contestId,
        String language,
        String status,
        Long userId
    ) {
        page = normalizePage(page);
        pageSize = normalizePageSize(pageSize);
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
        } else {
            // 前台全站提交队列不得混入比赛提交；比赛提交只在比赛内页通过 contestId 查看。
            wrapper.isNull("contest_id");
            if (problemId != null) {
                wrapper.eq("problem_id", problemId);
            }
        }
        if (language != null && !language.isBlank()) {
            wrapper.eq("language", language);
        }
        if (status != null && !status.isBlank()) {
            wrapper.eq("status", status);
        }
        wrapper.orderByDesc("created_at");
        Page<Submission> result = submissionMapper.selectPage(Page.of(page, pageSize), wrapper);

        // 比赛期间隐藏他人提交状态：allowViewAllSubmissions=false 且比赛进行中
        boolean maskOthersStatus = false;
        if (contestId != null) {
            com.qoj.module.contest.entity.Contest contest = contestMapper.selectById(contestId);
            if (contest != null
                && Boolean.FALSE.equals(contest.allowViewAllSubmissions)
                && "RUNNING".equals(contest.status)
                && LocalDateTime.now().isBefore(contest.endTime)) {
                try {
                    AuthUser authUser = CurrentUser.required();
                    boolean isAdmin = authUser.adminAccount();
                    boolean isOwner = contest.ownerId != null && contest.ownerId.equals(authUser.id());
                    maskOthersStatus = !isAdmin && !isOwner;
                } catch (Exception e) {
                    // 未登录用户也隐藏状态
                    maskOthersStatus = true;
                }
            }
        }

        final boolean doMask = maskOthersStatus;
        Long currentUserId;
        try {
            currentUserId = CurrentUser.id();
        } catch (Exception e) {
            currentUserId = null;
        }
        final Long uid = currentUserId;

        return new PageResult<>(result.getTotal(), result.getRecords().stream().map(item -> {
            SubmissionVO vo = toVO(item, false, false);
            if (doMask && !java.util.Objects.equals(item.userId, uid)) {
                /**
                 * 封装提交VO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
                 */
                return new SubmissionVO(
                    vo.id(), vo.userId(), vo.username(), vo.displayName(),
                    vo.problemId(), vo.problemTitle(), vo.contestId(), vo.practiceId(),
                    vo.language(), "PENDING",
                    null, null,
                    vo.identityType(), vo.identityId(),
                    vo.submitTime(), vo.createdAt(),
                    null, null, null, null
                );
            }
            return vo;
        }).toList());
    }


    private int normalizePage(int page) {
        return Math.max(1, page);
    }

    private int normalizePageSize(int pageSize) {
        if (pageSize <= 0) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(pageSize, MAX_PAGE_SIZE);
    }

    private int normalizeExportLimit(int limit) {
        if (limit <= 0) {
            return MAX_EXPORT_LIMIT;
        }
        return Math.min(limit, MAX_EXPORT_LIMIT);
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
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
        page = normalizePage(page);
        pageSize = normalizePageSize(pageSize);
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
            if (authUser.teacherAccount()) {
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
            wrapper.apply(
                "user_id IN (SELECT user_id FROM class_members WHERE class_id = {0})",
                classId
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
        wrapper.last("LIMIT " + normalizeExportLimit(limit));
        List<Submission> submissions = submissionMapper.selectList(wrapper);
        return submissions.stream().map(item -> toAdminVO(item, false, false)).toList();
    }

    public AdminSubmissionVO adminDetail(long id) {
        Submission submission = requireSubmission(id);
        /**
         * 校验管理员CanView提交。调用前会结合当前登录身份执行权限判断。
         */
        ensureAdminCanViewSubmission(CurrentUser.required(), submission);
        /**
         * 构造或转换管理员VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toAdminVO(submission, true, true);
    }

    public SubmissionVO detail(long id) {
        Submission submission = requireSubmission(id);
        AuthUser authUser = CurrentUser.required();

        boolean canViewDetail = canViewSubmissionDetail(authUser, submission);
        boolean canViewAfterEndCode = canViewContestSubmissionCodeAfterEnd(authUser, submission);
        if (!canViewDetail && !canViewAfterEndCode) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无权限查看该提交代码");
        }

        /**
         * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toVO(submission, canViewSubmissionCode(authUser, submission), canViewDetail);
    }

    public String code(long id) {
        Submission submission = requireSubmission(id);
        AuthUser authUser = CurrentUser.required();
        if (!canViewSubmissionCode(authUser, submission)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无权限查看该提交代码");
        }
        return submission.code;
    }

    public String adminCode(long id) {
        Submission submission = requireSubmission(id);
        /**
         * 校验管理员CanView提交。调用前会结合当前登录身份执行权限判断。
         */
        ensureAdminCanViewSubmission(CurrentUser.required(), submission);
        return submission.code;
    }

    @Transactional
    public AdminSubmissionVO adminRejudge(long id) {
        Submission submission = submissionMapper.selectByIdForUpdate(id);
        if (submission == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "提交记录不存在");
        }
        /**
         * 校验管理员CanView提交。调用前会结合当前登录身份执行权限判断。
         */
        ensureAdminCanViewSubmission(CurrentUser.required(), submission);
        if (!isFinalSubmissionStatus(submission.status)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(409, "提交尚未完成，不能发起重判");
        }
        if (submission.judgeWorkerId != null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(409, "原判题任务尚未释放，暂时不能重判");
        }

        // judgeBackend is intentionally preserved so a rejudge cannot switch workers.
        submission.status = SubmissionStatus.REJUDGE_PENDING.name();
        submission.isRejudged = true;
        submission.retryCount = safeInt(submission.retryCount) + 1;
        submission.priority = Math.max(safeInt(submission.priority), 1);
        submission.score = null;
        submission.timeUsed = null;
        submission.memoryUsed = null;
        submission.judgeStartTime = null;
        submission.judgeEndTime = null;
        submission.judgeMessage = null;
        submission.errorMessage = null;
        submission.judgeWorkerId = null;
        submission.updatedAt = LocalDateTime.now();

        submissionCaseResultMapper.delete(new QueryWrapper<SubmissionCaseResult>().eq("submission_id", submission.id));
        submissionMapper.updateById(submission);
        judgeMessagePublisher.submissionQueueUpdated();
        /**
         * 构造或转换管理员VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toAdminVO(submission, false, false);
    }

    private boolean isFinalSubmissionStatus(String status) {
        if (status == null) {
            return false;
        }
        return switch (status.trim().toUpperCase()) {
            case "AC", "WA", "TLE", "MLE", "RE", "CE", "NOO", "SE", "FAILED" -> true;
            default -> false;
        };
    }

    @Transactional
    public void adminDelete(long id) {
        Submission submission = requireSubmission(id);
        /**
         * 校验管理员CanView提交。调用前会结合当前登录身份执行权限判断。
         */
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
        AuthUser user = CurrentUser.required();
        if (user.adminAccount()) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(403, "后台账号不能调试题目");
        }
        if (!settingService.isJudgeEnabled()) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(503, "判题服务已关闭，暂时无法调试");
        }
        var judgeSettings = settingService.getJudgeSettings();
        if (!judgeSettings.enableSandbox) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(503, "沙箱调试功能未启用");
        }
        if (!goJudgeService.supportsLanguage(request.language())) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, "不支持的编程语言");
        }
        try (SandboxExecutionGuard.Permit ignored = sandboxExecutionGuard.acquire(user.id())) {
            SandboxRun run = new SandboxRun();
            run.userId = user.id();
            run.code = request.code();
            run.language = request.language();
            run.input = request.input();
            SandboxRunResult result = runSandbox(request);
            String output = result.output() == null || result.output().isBlank()
                ? result.error()
                : result.output();
            run.output = limitSandboxOutput(output);
            run.status = result.status();
            run.runAt = LocalDateTime.now();
            sandboxRunMapper.insert(run);
            /**
             * 封装沙箱RunVO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new SandboxRunVO(run.id, run.output, run.status, run.runAt);
        }
    }

    private SandboxRunResult runSandbox(SandboxRunRequest request) {
        // Custom runs share go-judge's isolated worker and fixed language allowlist.
        JudgeService.SandboxResult result = goJudgeService.runCustom(
            request.language(), request.code(), request.input(), 2000, 256);
        /**
         * 构造 沙箱Run结果 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new SandboxRunResult(result.output(), result.error(), result.status());
    }

    /** Keep UTF-8 output below MySQL TEXT's byte limit without splitting a character. */
    static String limitSandboxOutput(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        if (bytes.length <= MAX_SANDBOX_OUTPUT_BYTES) {
            return value;
        }
        byte[] suffix = SANDBOX_OUTPUT_TRUNCATED.getBytes(StandardCharsets.UTF_8);
        int end = MAX_SANDBOX_OUTPUT_BYTES - suffix.length;
        while (end > 0 && (bytes[end] & 0xC0) == 0x80) {
            end--;
        }
        /**
         * 封装String相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new String(bytes, 0, end, StandardCharsets.UTF_8) + SANDBOX_OUTPUT_TRUNCATED;
    }

    /**
     * 沙箱Run结果不可变数据载体。通过 record 语义表达一组只读字段及其结构约束。
     */
    private record SandboxRunResult(String output, String error, String status) {
    }

    private Submission requireSubmission(long id) {
        Submission submission = submissionMapper.selectById(id);
        if (submission == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
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
        if (authUser == null || (!authUser.adminAccount() && !authUser.teacherAccount())) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
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
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
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
                .apply(
                    "contest_id IN (SELECT id FROM contests "
                        + "WHERE owner_id = {0} AND owner_account_type = 'ADMIN')",
                    authUser.id()
                )
                .or()
                .apply(
                    "practice_id IN (SELECT id FROM practices WHERE owner_id = {0} AND owner_account_type = 'ADMIN')",
                    authUser.id()
                )
                .or(item -> item
                    .isNull("contest_id")
                    .apply("problem_id IN (SELECT id FROM problems WHERE owner_id = {0} AND owner_account_type = 'ADMIN')", authUser.id())
                )
            );
            return;
        }
        if (authUser.teacherAccount()) {
            if (userId != null) {
                wrapper.eq("user_id", userId);
            }
            wrapper.apply(
                "user_id IN (SELECT cm.user_id FROM class_members cm "
                    + "WHERE cm.class_id IN (SELECT id FROM classes WHERE teacher_id = {0}))",
                authUser.id()
            );
            return;
        }
        wrapper.eq("user_id", authUser.id());
    }

    private void ensureCanManageContest(AuthUser authUser, Long contestId) {
        if (authUser == null || (!authUser.adminAccount() && !authUser.teacherAccount())) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无权查看该比赛提交");
        }
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "比赛不存在");
        }
        if (!contestAccessPolicy.can(authUser, com.qoj.security.policy.Permission.MANAGE_SCOREBOARD, contest)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
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
        Map<Integer, TestCasePreview> testCaseMap = includeCases ? buildTestCaseMap(submission) : Map.of();
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
        Map<Integer, TestCasePreview> testCaseMap = includeCases ? buildTestCaseMap(submission) : Map.of();
        List<SubmissionCaseVO> cases = includeCases
            ? submissionCaseResultMapper
                .selectList(new QueryWrapper<SubmissionCaseResult>().eq("submission_id", submission.id).orderByAsc("case_no"))
                .stream()
                .map(item -> toCaseVO(item, testCaseMap))
                .toList()
            : List.of();
        Integer timeUsed = positiveOrNull(submission.timeUsed);
        if (timeUsed == null) {
            timeUsed = includeCases ? maxCaseTimeMs(cases) : maxCaseTimeMs(submission.id);
        }
        Integer memoryUsed = positiveOrNull(submission.memoryUsed);
        if (memoryUsed == null) {
            memoryUsed = includeCases ? maxCaseMemoryKb(cases) : maxCaseMemoryKb(submission.id);
        }
        User user = submission.userId == null ? null : userMapper.selectById(submission.userId);
        return new SubmissionVO(
            submission.id,
            submission.userId,
            user == null ? null : user.username,
            user == null ? null : user.displayName,
            submission.problemId,
            problemTitle(submission),
            submission.contestId,
            submission.practiceId,
            submission.language,
            submission.status,
            timeUsed,
            memoryUsed,
            submission.identityType,
            submission.identityId,
            submission.submitTime == null ? submission.createdAt : submission.submitTime,
            submission.createdAt,
            Math.toIntExact(passedCaseCount),
            Math.toIntExact(totalCaseCount),
            includeCode ? submission.code : null,
            cases
        );
    }

    private Integer maxCaseTimeMs(List<SubmissionCaseVO> cases) {
        Integer maxTimeMs = null;
        for (SubmissionCaseVO item : cases) {
            Integer timeMs = positiveOrNull(item.timeMs());
            if (timeMs != null && (maxTimeMs == null || timeMs > maxTimeMs)) {
                maxTimeMs = timeMs;
            }
        }
        return maxTimeMs;
    }

    private Integer maxCaseTimeMs(Long submissionId) {
        if (submissionId == null) {
            return null;
        }
        List<SubmissionCaseResult> cases = submissionCaseResultMapper.selectList(
            new QueryWrapper<SubmissionCaseResult>().eq("submission_id", submissionId)
        );
        Integer maxTimeMs = null;
        for (SubmissionCaseResult item : cases) {
            Integer timeMs = positiveOrNull(item.timeUsed);
            if (timeMs != null && (maxTimeMs == null || timeMs > maxTimeMs)) {
                maxTimeMs = timeMs;
            }
        }
        return maxTimeMs;
    }

    private Integer maxCaseMemoryKb(List<SubmissionCaseVO> cases) {
        Integer maxMemoryKb = null;
        for (SubmissionCaseVO item : cases) {
            Integer memoryKb = positiveOrNull(item.memoryKb());
            if (memoryKb != null && (maxMemoryKb == null || memoryKb > maxMemoryKb)) {
                maxMemoryKb = memoryKb;
            }
        }
        return maxMemoryKb;
    }

    private Integer maxCaseMemoryKb(Long submissionId) {
        if (submissionId == null) {
            return null;
        }
        List<SubmissionCaseResult> cases = submissionCaseResultMapper.selectList(
            new QueryWrapper<SubmissionCaseResult>().eq("submission_id", submissionId)
        );
        Integer maxMemoryKb = null;
        for (SubmissionCaseResult item : cases) {
            Integer memoryKb = positiveOrNull(item.memoryUsed);
            if (memoryKb != null && (maxMemoryKb == null || memoryKb > maxMemoryKb)) {
                maxMemoryKb = memoryKb;
            }
        }
        return maxMemoryKb;
    }

    private Integer positiveOrNull(Integer value) {
        return value != null && value > 0 ? value : null;
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

    private SubmissionCaseVO toCaseVO(SubmissionCaseResult item, Map<Integer, TestCasePreview> testCaseMap) {
        String inputPreview = item.inputPreview;
        String outputPreview = item.outputPreview;
        String expectedPreview = item.expectedPreview;
        if (testCaseMap != null) {
            TestCasePreview tc = testCaseMap.get(item.caseNo);
            if (tc != null) {
                if (inputPreview == null || inputPreview.isBlank()) {
                    inputPreview = preview(tc.input());
                }
                if (expectedPreview == null || expectedPreview.isBlank()) {
                    expectedPreview = preview(tc.expectedOutput());
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

    private Map<Integer, TestCasePreview> buildTestCaseMap(Submission submission) {
        Map<Integer, TestCasePreview> map = new HashMap<>();
        if (submission.contestProblemId != null) {
            List<ContestProblemTestCase> cases = contestProblemTestCaseMapper.selectList(
                new QueryWrapper<ContestProblemTestCase>()
                    .eq("contest_problem_id", submission.contestProblemId)
                    .eq("sample", false)
            );
            for (ContestProblemTestCase testCase : cases) {
                map.put(testCase.caseNo, new TestCasePreview(testCase.inputData, testCase.outputData));
            }
            return map;
        }
        if (submission.problemId != null) {
            for (ProblemTestCase testCase : problemTestCaseMapper.selectByProblemId(submission.problemId)) {
                map.put(testCase.caseNo, new TestCasePreview(testCase.inputData, testCase.outputData));
            }
        }
        return map;
    }

    private record TestCasePreview(String input, String expectedOutput) {
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
            || isContestManager(authUser, submission)
            || canViewContestSubmissionCodeAfterEnd(authUser, submission);
    }

    private boolean canViewContestSubmissionCodeAfterEnd(AuthUser authUser, Submission submission) {
        if (authUser == null || authUser.adminAccount() || submission == null || submission.contestId == null) {
            return false;
        }
        Contest contest = contestMapper.selectById(submission.contestId);
        if (contest == null
            || contest.endTime == null
            || LocalDateTime.now().isBefore(contest.endTime)
            || !Boolean.TRUE.equals(contest.allowAfterEndViewCode)) {
            return false;
        }
        return contestService.registrationForUser(submission.contestId, authUser.id()) != null;
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
        String ownerType = contest.ownerAccountType == null ? "UNKNOWN" : contest.ownerAccountType;
        return contest.ownerId.equals(authUser.id())
            && authUser.accountType().equals(ownerType);
    }

    /**
     * 验证 Practice 提交的合法性
     */
    private void validatePracticeSubmission(SubmissionCreateRequest request, AuthUser user) {
        if (!"USER".equals(user.accountType())
            || !practicePublicationService.canSubmit(request.practiceId(), user.id(), request.problemId())) {
            throw new BizException(ErrorCode.FORBIDDEN, "题单不可访问或题目已隐藏");
        }
    }

}

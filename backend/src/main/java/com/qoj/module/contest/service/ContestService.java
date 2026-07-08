package com.qoj.module.contest.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.ErrorCode;
import com.qoj.common.PageResult;
import com.qoj.common.enums.AudienceType;
import com.qoj.common.enums.ContestStatus;
import com.qoj.common.enums.ContestType;
import com.qoj.common.enums.IdentityType;
import com.qoj.common.exception.BizException;
import com.qoj.common.redis.RedisKeys;
import com.qoj.module.contest.dto.ContestAudienceRequest;
import com.qoj.module.contest.dto.ContestCreateRequest;
import com.qoj.module.contest.dto.ContestDraftRequest;
import com.qoj.module.contest.dto.ContestProblemRequest;
import com.qoj.module.contest.dto.ContestRegisterRequest;
import com.qoj.module.contest.dto.ContestUpdateRequest;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.entity.ContestAudience;
import com.qoj.module.contest.entity.ContestParticipant;
import com.qoj.module.contest.entity.ContestProblem;
import com.qoj.module.contest.entity.ContestProblemCaseScore;
import com.qoj.module.contest.entity.ContestProblemTestCase;
import com.qoj.module.contest.entity.ContestRegistration;
import com.qoj.module.contest.entity.ContestRollingState;
import com.qoj.module.contest.mapper.ContestAudienceMapper;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.contest.mapper.ContestParticipantMapper;
import com.qoj.module.contest.mapper.ContestProblemCaseScoreMapper;
import com.qoj.module.contest.mapper.ContestProblemMapper;
import com.qoj.module.contest.mapper.ContestProblemTestCaseMapper;
import com.qoj.module.contest.mapper.ContestRegistrationMapper;
import com.qoj.module.contest.mapper.ContestRollingStateMapper;
import com.qoj.module.contest.vo.ContestAudienceVO;
import com.qoj.module.contest.vo.ContestProblemCaseScoreVO;
import com.qoj.module.contest.vo.ContestProblemVO;
import com.qoj.module.contest.vo.ContestRegistrationOptionVO;
import com.qoj.module.contest.vo.ContestRollingStepVO;
import com.qoj.module.contest.vo.ContestScoreboardCellVO;
import com.qoj.module.contest.vo.ContestScoreboardProblemVO;
import com.qoj.module.contest.vo.ContestScoreboardRowVO;
import com.qoj.module.contest.vo.ContestScoreboardVO;
import com.qoj.module.contest.vo.ContestVO;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.entity.ProblemTestCase;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.mapper.ProblemTestCaseMapper;
import com.qoj.module.problem.vo.ProblemSampleCaseVO;
import com.qoj.module.problem.vo.ProblemVO;
import com.qoj.module.classroom.entity.ClassMember;
import com.qoj.module.classroom.entity.ClassRoom;
import com.qoj.module.classroom.mapper.ClassMemberMapper;
import com.qoj.module.classroom.mapper.ClassRoomMapper;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.entity.SubmissionCaseResult;
import com.qoj.module.submission.mapper.SubmissionCaseResultMapper;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.AdminUserMapper;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContestService {
    private static final BigDecimal DEFAULT_GOLD_RATIO = BigDecimal.valueOf(10);
    private static final BigDecimal DEFAULT_SILVER_RATIO = BigDecimal.valueOf(20);
    private static final BigDecimal DEFAULT_BRONZE_RATIO = BigDecimal.valueOf(30);

    private final ContestMapper contestMapper;
    private final ContestProblemMapper contestProblemMapper;
    private final ContestAudienceMapper contestAudienceMapper;
    private final ContestProblemCaseScoreMapper caseScoreMapper;
    private final ContestProblemTestCaseMapper contestProblemTestCaseMapper;
    private final ContestRegistrationMapper registrationMapper;
    private final ContestRollingStateMapper rollingStateMapper;
    private final ContestParticipantMapper participantMapper;
    private final ProblemMapper problemMapper;
    private final ProblemTestCaseMapper problemTestCaseMapper;
    private final SubmissionMapper submissionMapper;
    private final SubmissionCaseResultMapper submissionCaseResultMapper;
    private final UserMapper userMapper;
    private final AdminUserMapper adminUserMapper;
    private final ClassRoomMapper classRoomMapper;
    private final ClassMemberMapper classMemberMapper;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final com.qoj.security.policy.ContestAccessPolicy contestAccessPolicy;
    private final PasswordEncoder passwordEncoder;

    public ContestService(
        ContestMapper contestMapper,
        ContestProblemMapper contestProblemMapper,
        ContestAudienceMapper contestAudienceMapper,
        ContestProblemCaseScoreMapper caseScoreMapper,
        ContestProblemTestCaseMapper contestProblemTestCaseMapper,
        ContestRegistrationMapper registrationMapper,
        ContestRollingStateMapper rollingStateMapper,
        ContestParticipantMapper participantMapper,
        ProblemMapper problemMapper,
        ProblemTestCaseMapper problemTestCaseMapper,
        SubmissionMapper submissionMapper,
        SubmissionCaseResultMapper submissionCaseResultMapper,
        UserMapper userMapper,
        AdminUserMapper adminUserMapper,
        ClassRoomMapper classRoomMapper,
        ClassMemberMapper classMemberMapper,
        StringRedisTemplate redisTemplate,
        ObjectMapper objectMapper,
        com.qoj.security.policy.ContestAccessPolicy contestAccessPolicy,
        PasswordEncoder passwordEncoder
    ) {
        this.contestMapper = contestMapper;
        this.contestProblemMapper = contestProblemMapper;
        this.contestAudienceMapper = contestAudienceMapper;
        this.caseScoreMapper = caseScoreMapper;
        this.contestProblemTestCaseMapper = contestProblemTestCaseMapper;
        this.registrationMapper = registrationMapper;
        this.rollingStateMapper = rollingStateMapper;
        this.participantMapper = participantMapper;
        this.problemMapper = problemMapper;
        this.problemTestCaseMapper = problemTestCaseMapper;
        this.submissionMapper = submissionMapper;
        this.submissionCaseResultMapper = submissionCaseResultMapper;
        this.userMapper = userMapper;
        this.adminUserMapper = adminUserMapper;
        this.classRoomMapper = classRoomMapper;
        this.classMemberMapper = classMemberMapper;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.contestAccessPolicy = contestAccessPolicy;
        this.passwordEncoder = passwordEncoder;
    }

    public PageResult<ContestVO> list(int page, int pageSize) {
        QueryWrapper<Contest> wrapper = new QueryWrapper<>();

        // 过滤已删除的比赛
        wrapper.eq("is_deleted", false);

        // 根据用户身份过滤可见比赛
        AuthUser user = CurrentUser.get();
        if (user == null) {
            // 未登录：只看 ALL 类型
            wrapper.inSql("id", "SELECT DISTINCT contest_id FROM contest_audiences WHERE audience_type = 'ALL' AND audience_id = 0");
        } else if (user.adminAccount() || "SUPER_ADMIN".equals(user.role())) {
            // 管理员：看所有
        } else {
            // 普通用户：看自己有权访问的比赛
            List<Long> visibleContestIds = new ArrayList<>();

            // 查询 ALL 类型的比赛
            List<ContestAudience> allAudiences = contestAudienceMapper.selectList(
                new QueryWrapper<ContestAudience>()
                    .eq("audience_type", AudienceType.ALL.name())
                    .eq("audience_id", 0)
            );
            visibleContestIds.addAll(allAudiences.stream().map(a -> a.contestId).toList());

            List<Long> classIds = new ArrayList<>(
                classMemberMapper.selectList(new QueryWrapper<ClassMember>().eq("user_id", user.id()))
                    .stream()
                    .map(member -> member.classId)
                    .toList()
            );
            User entity = userMapper.selectById(user.id());
            if (entity != null && entity.classId != null && !classIds.contains(entity.classId)) {
                classIds.add(entity.classId);
            }
            if (!classIds.isEmpty()) {
                List<ContestAudience> classAudiences = contestAudienceMapper.selectList(
                    new QueryWrapper<ContestAudience>()
                        .eq("audience_type", AudienceType.CLASS.name())
                        .in("audience_id", classIds)
                );
                visibleContestIds.addAll(classAudiences.stream().map(a -> a.contestId).toList());
            }

            if (visibleContestIds.isEmpty()) {
                // 用户没有可见的比赛
                return new PageResult<>(0L, List.of());
            }

            // 去重
            visibleContestIds = visibleContestIds.stream().distinct().toList();
            wrapper.in("id", visibleContestIds);
        }

        wrapper.orderByDesc("start_time");
        Page<Contest> result = contestMapper.selectPage(Page.of(page, pageSize), wrapper);
        return new PageResult<>(result.getTotal(), result.getRecords().stream().map(this::toVO).toList());
    }

    public PageResult<ContestVO> adminList(int page, int pageSize) {
        AuthUser user = CurrentUser.required();
        if ("SUPER_ADMIN".equals(user.role())) {
            return list(page, pageSize);
        }

        QueryWrapper<Contest> wrapper = new QueryWrapper<>();
        wrapper.eq("is_deleted", false)
            .eq("owner_id", user.id())
            .eq("owner_account_type", user.adminAccount() ? "ADMIN" : "USER")
            .orderByDesc("start_time");
        Page<Contest> result = contestMapper.selectPage(Page.of(page, pageSize), wrapper);
        return new PageResult<>(result.getTotal(), result.getRecords().stream().map(this::toVO).toList());
    }

    public ContestVO detail(long id) {
        Contest contest = contestMapper.selectById(id);
        if (contest == null) {
            throw new BizException(ErrorCode.NOT_FOUND, "比赛不存在");
        }

        // 检查软删除（只有超级管理员和创建者能看到已删除的比赛）
        if (Boolean.TRUE.equals(contest.isDeleted)) {
            AuthUser user = CurrentUser.get();
            if (user == null) {
                throw new BizException(ErrorCode.NOT_FOUND, "比赛不存在");
            }
            boolean isOwner = contest.ownerId.equals(user.id())
                && ((user.adminAccount() && "ADMIN".equals(contest.ownerAccountType))
                    || (!user.adminAccount() && "USER".equals(contest.ownerAccountType)));
            if (!"SUPER_ADMIN".equals(user.role()) && !isOwner) {
                throw new BizException(ErrorCode.NOT_FOUND, "比赛不存在");
            }
        }

        if (!canCurrentUserViewContest(contest)) {
            throw new BizException(ErrorCode.FORBIDDEN, "无权查看该比赛");
        }

        return toVO(contest);
    }

    public ProblemVO problemDetail(long contestId, long contestProblemId) {
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "比赛不存在");
        }

        AuthUser user = CurrentUser.get();
        if (!canCurrentUserViewContestProblemDetail(user, contest)) {
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无权查看比赛题目");
        }

        // 检查用户是否有权访问该比赛（非 ALL 类型需要报名）
        if (!AudienceType.ALL.name().equals(contest.audience)) {
            if (user != null && !contestAccessPolicy.can(user, com.qoj.security.policy.Permission.UPDATE, contest)) {
                ContestRegistration registration = registrationMapper.selectOne(
                    new QueryWrapper<ContestRegistration>()
                        .eq("contest_id", contestId)
                        .eq("user_id", user.id())
                );
                if (registration == null) {
                    throw new BizException(ErrorCode.FORBIDDEN.getCode(), "请先报名比赛");
                }
                // 验证报名身份是否仍然有效
                try {
                    IdentityType type = IdentityType.valueOf(registration.identityType);
                    resolveRegistrationIdentity(contest, type, registration.identityId, user.id());
                } catch (BizException e) {
                    throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无权访问该比赛：" + e.getMessage());
                }
            }
        }

        ContestProblem contestProblem = contestProblemMapper.selectById(contestProblemId);
        if (contestProblem == null || !Long.valueOf(contestId).equals(contestProblem.contestId)) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "比赛题目不存在");
        }
        return toProblemDetailVO(contestProblem);
    }

    @Transactional
    public ContestVO create(ContestCreateRequest request) {
        var authUser = CurrentUser.required();
        Contest contest = new Contest();
        contest.title = request.title();
        contest.description = request.description();
        contest.durationMinutes = durationMinutes(request.durationMinutes(), request.startTime(), request.endTime());
        contest.startTime = request.startTime();
        contest.endTime = request.endTime();
        contest.type = request.type().name();
        contest.ownerId = authUser.id();
        contest.ownerAccountType = authUser.adminAccount() ? "ADMIN" : "USER";
        AudienceType primaryAudience = requireSupportedAudience(request.audience());
        contest.audience = primaryAudience.name();
        contest.audienceId = AudienceType.ALL.equals(primaryAudience) ? 0L : request.audienceId();
        ensureCanUseAudience(authUser, primaryAudience, contest.audienceId);
        contest.frozen = Boolean.TRUE.equals(request.frozen());
        contest.freezeTime = Boolean.TRUE.equals(contest.frozen) ? request.freezeTime() : null;
        contest.enableRollingScoreboard = Boolean.TRUE.equals(request.enableRollingScoreboard());
        contest.goldRatio = normalizeRatio(request.goldRatio(), DEFAULT_GOLD_RATIO);
        contest.silverRatio = normalizeRatio(request.silverRatio(), DEFAULT_SILVER_RATIO);
        contest.bronzeRatio = normalizeRatio(request.bronzeRatio(), DEFAULT_BRONZE_RATIO);
        contest.allowFullscreen = Boolean.TRUE.equals(request.allowFullscreen());
        contest.antiCheatEnabled = Boolean.TRUE.equals(request.antiCheatEnabled());
        contest.maxSwitches = request.maxSwitches() == null ? 3 : request.maxSwitches();
        contest.allowAfterEndSubmit = Boolean.TRUE.equals(request.allowAfterEndSubmit());
        contest.allowAfterEndViewProblem = request.allowAfterEndViewProblem() == null || Boolean.TRUE.equals(request.allowAfterEndViewProblem());
        contest.allowAfterEndViewCode = Boolean.TRUE.equals(request.allowAfterEndViewCode());
        contest.publicScoreboardEnabled = request.publicScoreboardEnabled() == null || Boolean.TRUE.equals(request.publicScoreboardEnabled());
        contest.showClassOnScoreboard = Boolean.TRUE.equals(request.showClassOnScoreboard());
        contest.allowStarRegistration = Boolean.TRUE.equals(request.allowStarRegistration());
        contest.allowViewAllSubmissions = request.allowViewAllSubmissions() == null || Boolean.TRUE.equals(request.allowViewAllSubmissions());
        contest.registrationPassword = encodeRegistrationPassword(request.registrationPassword());
        contest.registrationType = contest.registrationPassword == null
            ? (request.registrationType() == null ? "PUBLIC" : request.registrationType())
            : "PASSWORD";
        contest.status = calculateStatus(request.startTime(), request.endTime()).name();
        validateFreezeAndRollingSettings(contest);
        contestMapper.insert(contest);
        ensureCanUseAudiences(authUser, request.audiences());
        replaceAudiences(contest.id, primaryAudience, contest.audienceId, request.audiences());
        replaceProblems(contest.id, request.problems());
        redisTemplate.delete(contestDraftKey());
        return toVO(contest);
    }

    @Transactional
    public ContestVO update(long id, ContestUpdateRequest request) {
        Contest contest = requireOwnerOrSuperAdmin(id);
        if (request.title() != null) {
            contest.title = request.title();
        }
        if (request.description() != null) {
            contest.description = request.description();
        }
        if (request.durationMinutes() != null) {
            contest.durationMinutes = request.durationMinutes();
        }
        if (request.startTime() != null) {
            contest.startTime = request.startTime();
        }
        if (request.endTime() != null) {
            contest.endTime = request.endTime();
        }
        if (request.type() != null) {
            contest.type = request.type().name();
        }
        if (request.audience() != null) {
            contest.audience = requireSupportedAudience(request.audience()).name();
        }
        if (request.audienceId() != null) {
            contest.audienceId = request.audienceId();
        }
        if (AudienceType.ALL.name().equals(contest.audience)) {
            contest.audienceId = 0L;
        }
        if (request.frozen() != null) {
            contest.frozen = request.frozen();
        }
        if (request.freezeTime() != null || Boolean.FALSE.equals(request.frozen())) {
            contest.freezeTime = Boolean.TRUE.equals(contest.frozen) ? request.freezeTime() : null;
        }
        if (request.enableRollingScoreboard() != null) {
            contest.enableRollingScoreboard = request.enableRollingScoreboard();
        }
        if (request.goldRatio() != null) {
            contest.goldRatio = normalizeRatio(request.goldRatio(), DEFAULT_GOLD_RATIO);
        }
        if (request.silverRatio() != null) {
            contest.silverRatio = normalizeRatio(request.silverRatio(), DEFAULT_SILVER_RATIO);
        }
        if (request.bronzeRatio() != null) {
            contest.bronzeRatio = normalizeRatio(request.bronzeRatio(), DEFAULT_BRONZE_RATIO);
        }
        if (request.allowFullscreen() != null) {
            contest.allowFullscreen = request.allowFullscreen();
        }
        if (request.antiCheatEnabled() != null) {
            contest.antiCheatEnabled = request.antiCheatEnabled();
        }
        if (request.maxSwitches() != null) {
            contest.maxSwitches = request.maxSwitches();
        }
        if (request.allowAfterEndSubmit() != null) {
            contest.allowAfterEndSubmit = request.allowAfterEndSubmit();
        }
        if (request.allowAfterEndViewProblem() != null) {
            contest.allowAfterEndViewProblem = request.allowAfterEndViewProblem();
        }
        if (request.allowAfterEndViewCode() != null) {
            contest.allowAfterEndViewCode = request.allowAfterEndViewCode();
        }
        if (request.publicScoreboardEnabled() != null) {
            contest.publicScoreboardEnabled = request.publicScoreboardEnabled();
        }
        if (request.showClassOnScoreboard() != null) {
            contest.showClassOnScoreboard = request.showClassOnScoreboard();
        }
        if (request.allowStarRegistration() != null) {
            contest.allowStarRegistration = request.allowStarRegistration();
        }
        if (request.allowViewAllSubmissions() != null) {
            contest.allowViewAllSubmissions = request.allowViewAllSubmissions();
        }
        if (request.registrationType() != null) {
            contest.registrationType = request.registrationType();
        }
        if (request.registrationPassword() != null) {
            contest.registrationPassword = encodeRegistrationPassword(request.registrationPassword());
            if (contest.registrationPassword == null && "PASSWORD".equals(contest.registrationType)) {
                contest.registrationType = "PUBLIC";
            } else if (contest.registrationPassword != null) {
                contest.registrationType = "PASSWORD";
            }
        }
        if (request.status() != null) {
            contest.status = request.status().name();
        }
        if (contest.durationMinutes == null && contest.startTime != null && contest.endTime != null) {
            contest.durationMinutes = durationMinutes(null, contest.startTime, contest.endTime);
        }
        validateFreezeAndRollingSettings(contest);
        ensureCanUseAudience(CurrentUser.required(), AudienceType.valueOf(contest.audience), contest.audienceId);
        ensureCanUseAudiences(CurrentUser.required(), request.audiences());
        contestMapper.updateById(contest);
        if (request.audience() != null || request.audienceId() != null || request.audiences() != null) {
            AudienceType fallbackAudience = request.audience() == null
                ? AudienceType.valueOf(contest.audience)
                : requireSupportedAudience(request.audience());
            replaceAudiences(contest.id, fallbackAudience, contest.audienceId, request.audiences());
        }
        if (request.problems() != null) {
            replaceProblems(contest.id, request.problems());
        }
        redisTemplate.delete(RedisKeys.contestBoard(contest.id));
        return toVO(contest);
    }

    @Transactional
    public void register(long id, ContestRegisterRequest request) {
        Contest contest = contestMapper.selectById(id);
        if (contest == null) {
            throw new BizException(404, "比赛不存在");
        }
        var user = CurrentUser.required();
        if (user.adminAccount()) {
            throw new BizException(403, "后台账号不能报名比赛");
        }
        verifyRegistrationPassword(contest, request.password());

        // 获取用户信息
        User userEntity = userMapper.selectById(user.id());
        if (userEntity == null) {
            throw new BizException(404, "用户不存在");
        }

        RegistrationIdentity identity = resolveRegistrationIdentity(contest, request.identityType(), request.identityId(), user.id());
        ContestRegistration registration = new ContestRegistration();
        registration.contestId = id;
        registration.userId = user.id();
        registration.username = userEntity.username;
        registration.displayName = userEntity.displayName;
        registration.identityType = identity.type().name();
        registration.identityId = identity.id();
        registration.starred = Boolean.TRUE.equals(contest.allowStarRegistration) && Boolean.TRUE.equals(request.starred());
        registration.status = "APPROVED"; // 默认自动通过，可根据 registrationType 调整
        registration.registeredAt = LocalDateTime.now();

        registrationMapper.delete(
            new QueryWrapper<ContestRegistration>()
                .eq("contest_id", id)
                .eq("user_id", user.id())
        );
        registrationMapper.insert(registration);
        upsertParticipant(contest, registration);

        // 更新比赛统计
        updateContestStats(id);
    }

    public List<ContestRegistrationOptionVO> registrationOptions(long id) {
        Contest contest = contestMapper.selectById(id);
        if (contest == null) {
            throw new BizException(404, "比赛不存在");
        }
        var user = CurrentUser.required();
        if (user.adminAccount()) {
            throw new BizException(403, "后台账号不能报名比赛");
        }
        java.util.ArrayList<ContestRegistrationOptionVO> options = new java.util.ArrayList<>();
        boolean contestVisible = isContestVisibleToUser(contest.id, user.id());
        options.add(new ContestRegistrationOptionVO(
            IdentityType.PERSONAL.name(),
            user.id(),
            user.displayName(),
            contestVisible,
            contestVisible ? null : "当前账号不在比赛开放范围内",
            Boolean.TRUE.equals(contest.allowStarRegistration)
        ));

        return options;
    }


    public ContestScoreboardVO scoreboard(long id) {
        Contest contest = contestMapper.selectById(id);
        if (contest == null) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "比赛不存在");
        }

        // 使用Policy检查封榜状态下的查看权限
        AuthUser user = CurrentUser.get();
        boolean frozenForViewer = isActiveFreeze(contest) && !contestAccessPolicy.canViewScoreboardDuringFreeze(user, contest);
        return buildScoreboard(contest, frozenForViewer ? contest.freezeTime : null, !frozenForViewer && isEnded(contest));
    }

    public ContestScoreboardVO scoreboardForAdminExport(long id) {
        Contest contest = contestMapper.selectById(id);
        if (contest == null || Boolean.TRUE.equals(contest.isDeleted)) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "比赛不存在");
        }
        return buildScoreboard(contest, null, true);
    }

    private ContestScoreboardVO buildScoreboard(Contest contest) {
        return buildScoreboard(contest, null, false);
    }

    public ContestScoreboardVO scoreboardForSnapshot(long id, String snapshotType) {
        Contest contest = contestMapper.selectById(id);
        if (contest == null || Boolean.TRUE.equals(contest.isDeleted)) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "比赛不存在");
        }
        String normalized = snapshotType == null ? "" : snapshotType.trim().toLowerCase();
        if ("freeze".equals(normalized)) {
            return buildScoreboard(contest, contest.freezeTime, false);
        }
        if ("final".equals(normalized)) {
            return buildScoreboard(contest, null, true);
        }
        throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "快照类型必须是 freeze 或 final");
    }

    public ContestScoreboardVO scoreboardForRolling(Long contestId, boolean finalBoard) {
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null || Boolean.TRUE.equals(contest.isDeleted)) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "比赛不存在");
        }
        return buildScoreboard(contest, finalBoard ? null : contest.freezeTime, finalBoard);
    }

    private ContestScoreboardVO buildScoreboard(Contest contest, LocalDateTime cutoff, boolean showMedals) {
        List<ContestProblem> contestProblems = contestProblemMapper.selectList(
            new QueryWrapper<ContestProblem>().eq("contest_id", contest.id).orderByAsc("display_order")
        );
        List<ContestScoreboardProblemVO> problemVOs = contestProblems.stream()
            .map(item -> new ContestScoreboardProblemVO(
                item.id,
                item.label,
                item.title,
                item.score
            ))
            .toList();
        List<Submission> submissions = submissionMapper.selectList(
            new QueryWrapper<Submission>()
                .eq("contest_id", contest.id)
                .orderByAsc("created_at")
                .orderByAsc("id")
        )
            .stream()
            .filter(submission -> isRankedSubmission(contest, submission, cutoff))
            .toList();
        List<ContestScoreboardRowVO> rows = ContestType.OI.name().equals(contest.type)
            ? oiScoreboardRows(contest, contestProblems, submissions)
            : acmScoreboardRows(contest, contestProblems, submissions);
        rows = applyMedals(rows, contest, showMedals);
        rows = enrichScoreboardClassInfo(contest, rows);
        return new ContestScoreboardVO(
            contest.id,
            contest.title,
            contest.type,
            effectiveStatus(contest).name(),
            contest.startTime,
            contest.endTime,
            contest.durationMinutes == null ? durationMinutes(null, contest.startTime, contest.endTime) : contest.durationMinutes,
            problemVOs,
            rows,
            Boolean.TRUE.equals(contest.showClassOnScoreboard)
        );
    }

    public ContestDraftRequest draft() {
        String value = redisTemplate.opsForValue().get(contestDraftKey());
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(value, ContestDraftRequest.class);
        } catch (Exception ignored) {
            return null;
        }
    }

    public ContestDraftRequest saveDraft(ContestDraftRequest request) {
        try {
            redisTemplate.opsForValue().set(contestDraftKey(), objectMapper.writeValueAsString(request));
            return request;
        } catch (JsonProcessingException ex) {
            throw new BizException(400, "比赛草稿保存失败");
        }
    }

    public void clearDraft() {
        redisTemplate.delete(contestDraftKey());
    }


    private void replaceProblems(Long contestId, List<ContestProblemRequest> problems) {
        // 在删除旧 contest_problems 之前，建立 sourceProblemId -> oldContestProblemId 的映射
        List<ContestProblem> oldContestProblems = contestProblemMapper.selectList(
            new QueryWrapper<ContestProblem>().eq("contest_id", contestId)
        );
        Map<Long, Long> sourceToOldId = new java.util.LinkedHashMap<>();
        for (ContestProblem cp : oldContestProblems) {
            if (cp.problemId != null) {
                sourceToOldId.put(cp.problemId, cp.id);
            }
        }

        contestProblemTestCaseMapper.delete(
            new QueryWrapper<ContestProblemTestCase>()
                .inSql("contest_problem_id", "SELECT id FROM contest_problems WHERE contest_id = " + contestId)
        );
        caseScoreMapper.delete(new QueryWrapper<ContestProblemCaseScore>().eq("contest_id", contestId));
        contestProblemMapper.delete(new QueryWrapper<ContestProblem>().eq("contest_id", contestId));
        if (problems == null) {
            return;
        }

        // sourceProblemId -> newContestProblemId 的映射
        Map<Long, Long> sourceToNewId = new java.util.LinkedHashMap<>();

        for (ContestProblemRequest request : problems) {
            Problem sourceProblem = problemMapper.selectById(request.problemId());
            if (sourceProblem == null) {
                throw new BizException(404, "题目不存在：" + request.problemId());
            }
            ContestProblem contestProblem = new ContestProblem();
            contestProblem.contestId = contestId;
            contestProblem.problemId = request.problemId();
            contestProblem.label = request.label();
            contestProblem.score = request.score();
            contestProblem.displayOrder = request.displayOrder() == null ? 0 : request.displayOrder();
            contestProblem.title = sourceProblem.title;
            contestProblem.statement = sourceProblem.statement;
            contestProblem.inputFormat = sourceProblem.inputFormat;
            contestProblem.outputFormat = sourceProblem.outputFormat;
            contestProblem.sampleCases = sourceProblem.sampleCases;
            contestProblem.timeLimit = sourceProblem.timeLimit;
            contestProblem.memoryLimit = sourceProblem.memoryLimit;
            contestProblem.difficulty = sourceProblem.difficulty;
            contestProblem.tags = sourceProblem.tags;
            contestProblem.domjudgeProblemId = sourceProblem.domjudgeProblemId;
            contestProblemMapper.insert(contestProblem);
            sourceToNewId.put(request.problemId(), contestProblem.id);
            copyProblemTestCasesToContestProblem(sourceProblem.id, contestProblem.id);
            if (request.caseScores() != null) {
                Map<Integer, Integer> caseScores = new LinkedHashMap<>();
                for (var caseScoreRequest : request.caseScores()) {
                    if (caseScoreRequest.caseNo() == null) {
                        continue;
                    }
                    caseScores.put(caseScoreRequest.caseNo(), caseScoreRequest.score() == null ? 0 : caseScoreRequest.score());
                }
                for (Map.Entry<Integer, Integer> entry : caseScores.entrySet()) {
                    ContestProblemCaseScore caseScore = new ContestProblemCaseScore();
                    caseScore.contestId = contestId;
                    caseScore.problemId = contestProblem.id;
                    caseScore.caseNo = entry.getKey();
                    caseScore.score = entry.getValue();
                    caseScoreMapper.insert(caseScore);
                }
            }
        }

        // 将已有提交记录的 contest_problem_id 从旧ID重新映射到新ID
        for (Map.Entry<Long, Long> entry : sourceToOldId.entrySet()) {
            Long sourceProblemId = entry.getKey();
            Long oldContestProblemId = entry.getValue();
            Long newContestProblemId = sourceToNewId.get(sourceProblemId);
            if (newContestProblemId != null && !newContestProblemId.equals(oldContestProblemId)) {
                Submission update = new Submission();
                update.contestProblemId = newContestProblemId;
                submissionMapper.update(update,
                    new QueryWrapper<Submission>()
                        .eq("contest_id", contestId)
                        .eq("contest_problem_id", oldContestProblemId)
                );
            }
        }
    }

    private void copyProblemTestCasesToContestProblem(Long sourceProblemId, Long contestProblemId) {
        List<ProblemTestCase> sourceCases = problemTestCaseMapper.selectList(
            new QueryWrapper<ProblemTestCase>().eq("problem_id", sourceProblemId).orderByAsc("sample").orderByAsc("case_no")
        );
        for (ProblemTestCase sourceCase : sourceCases) {
            ContestProblemTestCase target = new ContestProblemTestCase();
            target.contestProblemId = contestProblemId;
            target.caseNo = sourceCase.caseNo;
            target.inputData = sourceCase.inputData;
            target.outputData = sourceCase.outputData;
            target.explanation = sourceCase.explanation;
            target.sample = sourceCase.sample;
            contestProblemTestCaseMapper.insert(target);
        }
    }

    private void replaceAudiences(
        Long contestId,
        AudienceType fallbackAudience,
        Long fallbackAudienceId,
        List<ContestAudienceRequest> audiences
    ) {
        contestAudienceMapper.delete(new QueryWrapper<ContestAudience>().eq("contest_id", contestId));
        List<ContestAudienceRequest> normalized = normalizeAudiences(fallbackAudience, fallbackAudienceId, audiences);
        for (ContestAudienceRequest request : normalized) {
            ContestAudience audience = new ContestAudience();
            audience.contestId = contestId;
            audience.audienceType = request.audienceType().name();
            audience.audienceId = request.audienceId() == null ? 0L : request.audienceId();
            contestAudienceMapper.insert(audience);
        }
    }

    private List<ContestAudienceRequest> normalizeAudiences(
        AudienceType fallbackAudience,
        Long fallbackAudienceId,
        List<ContestAudienceRequest> audiences
    ) {
        if (audiences != null && !audiences.isEmpty()) {
            List<ContestAudienceRequest> normalized = new ArrayList<>();
            for (ContestAudienceRequest item : audiences) {
                AudienceType audienceType = requireSupportedAudience(item.audienceType());
                Long audienceId = AudienceType.ALL.equals(audienceType) ? 0L : (item.audienceId() == null ? 0L : item.audienceId());
                normalized.add(new ContestAudienceRequest(audienceType, audienceId));
            }
            return normalized;
        }
        AudienceType type = fallbackAudience == null ? AudienceType.ALL : requireSupportedAudience(fallbackAudience);
        Long audienceId = AudienceType.ALL.equals(type) ? 0L : (fallbackAudienceId == null ? 0L : fallbackAudienceId);
        return List.of(new ContestAudienceRequest(type, audienceId));
    }

    private AudienceType requireSupportedAudience(AudienceType audienceType) {
        if (audienceType == null || AudienceType.ALL.equals(audienceType)) {
            return AudienceType.ALL;
        }
        if (AudienceType.CLASS.equals(audienceType)) {
            return AudienceType.CLASS;
        }
        throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "比赛开放范围仅支持所有人或班级");
    }

    private void ensureCanUseAudiences(AuthUser user, List<ContestAudienceRequest> audiences) {
        if (audiences == null) {
            return;
        }
        for (ContestAudienceRequest audience : audiences) {
            AudienceType type = requireSupportedAudience(audience.audienceType());
            ensureCanUseAudience(user, type, AudienceType.ALL.equals(type) ? 0L : audience.audienceId());
        }
    }

    private void ensureCanUseAudience(AuthUser user, AudienceType audience, Long audienceId) {
        if (audience == null || audience == AudienceType.ALL) {
            return;
        }
        if ("SUPER_ADMIN".equals(user.role())) {
            return;
        }
        if (audience == AudienceType.CLASS) {
            if (audienceId == null || audienceId == 0) {
                throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "班级 ID 不能为空");
            }
            ClassRoom classRoom = classRoomMapper.selectById(audienceId);
            if (classRoom == null) {
                throw new BizException(ErrorCode.NOT_FOUND.getCode(), "班级不存在");
            }
            if (!"TEACHER".equals(user.role()) || !user.id().equals(classRoom.teacherId)) {
                throw new BizException(ErrorCode.FORBIDDEN.getCode(), "只能选择自己管理的班级");
            }
            return;
        }
    }

    private Contest requireOwnerOrSuperAdmin(long id) {
        Contest contest = contestMapper.selectById(id);
        if (contest == null) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "比赛不存在");
        }
        var user = CurrentUser.required();
        if (!contestAccessPolicy.can(user, com.qoj.security.policy.Permission.UPDATE, contest)) {
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无访问权限");
        }
        return contest;
    }

    private boolean isOwner(Contest contest, com.qoj.security.AuthUser user) {
        if (!contest.ownerId.equals(user.id())) {
            return false;
        }
        String ownerType = contest.ownerAccountType == null ? "USER" : contest.ownerAccountType;
        return user.adminAccount() ? "ADMIN".equals(ownerType) : "USER".equals(ownerType);
    }

    private RegistrationIdentity resolveRegistrationIdentity(
        Contest contest,
        IdentityType requestedType,
        Long requestedId,
        Long userId
    ) {
        IdentityType type = requestedType == null ? IdentityType.PERSONAL : requestedType;
        if (type == IdentityType.PERSONAL) {
            if (!isContestVisibleToUser(contest.id, userId)) {
                throw new BizException(403, "当前账号不在比赛开放范围内");
            }
            return new RegistrationIdentity(type, userId);
        }
        throw new BizException(400, "不支持的报名身份");
    }

    private boolean canCurrentUserViewContest(Contest contest) {
        if (contest == null) {
            return false;
        }
        AuthUser user = CurrentUser.get();
        if (isContestOwnerOrSuperAdmin(contest, user)) {
            return true;
        }
        if (audienceAllows(contest.id, AudienceType.ALL, 0L)) {
            return true;
        }
        if (user == null || user.adminAccount() || user.id() == null) {
            return false;
        }
        return isContestVisibleToUser(contest.id, user.id());
    }

    private boolean canCurrentUserViewContestProblemDetail(AuthUser user, Contest contest) {
        if (contest == null) {
            return false;
        }
        LocalDateTime now = LocalDateTime.now();
        boolean privileged = isContestOwnerOrSuperAdmin(contest, user);
        if (now.isBefore(contest.startTime)) {
            return privileged;
        }
        if (now.isAfter(contest.endTime)
            && Boolean.FALSE.equals(contest.allowAfterEndViewProblem)
            && !privileged) {
            return false;
        }
        if (privileged) {
            return true;
        }
        if (audienceAllows(contest.id, AudienceType.ALL, 0L)) {
            return true;
        }
        return user != null && !user.adminAccount() && user.id() != null && isContestVisibleToUser(contest.id, user.id());
    }

    private boolean isContestOwnerOrSuperAdmin(Contest contest, AuthUser user) {
        if (user == null) {
            return false;
        }
        if ("SUPER_ADMIN".equals(user.role())) {
            return true;
        }
        if (contest.ownerId == null) {
            return false;
        }
        String ownerType = contest.ownerAccountType == null ? "USER" : contest.ownerAccountType;
        return contest.ownerId.equals(user.id())
            && ((user.adminAccount() && "ADMIN".equals(ownerType))
                || (!user.adminAccount() && "USER".equals(ownerType)));
    }

    private boolean isContestVisibleToUser(Long contestId, Long userId) {
        if (audienceAllows(contestId, AudienceType.ALL, 0L)) {
            return true;
        }
        User user = userMapper.selectById(userId);
        if (user != null && user.classId != null && audienceAllows(contestId, AudienceType.CLASS, user.classId)) {
            return true;
        }
        List<ClassMember> classes = classMemberMapper.selectList(new QueryWrapper<ClassMember>().eq("user_id", userId));
        for (ClassMember member : classes) {
            if (audienceAllows(contestId, AudienceType.CLASS, member.classId)) {
                return true;
            }
        }
        return false;
    }

    private boolean audienceAllows(Long contestId, AudienceType type, Long audienceId) {
        QueryWrapper<ContestAudience> wrapper = new QueryWrapper<ContestAudience>()
            .eq("contest_id", contestId)
            .eq("audience_type", type.name());
        if (type == AudienceType.ALL) {
            wrapper.eq("audience_id", 0);
        } else {
            wrapper.eq("audience_id", audienceId == null ? 0L : audienceId);
        }
        boolean explicit = contestAudienceMapper.selectCount(wrapper) > 0;
        if (explicit) {
            return true;
        }
        return type != AudienceType.ALL
            && contestAudienceMapper.selectCount(
                new QueryWrapper<ContestAudience>()
                    .eq("contest_id", contestId)
                    .eq("audience_type", AudienceType.ALL.name())
                    .eq("audience_id", 0)
            ) > 0;
    }

    public ContestProblem requireSubmittableContestProblem(Long contestId, Long submittedProblemId, Long userId) {
        // 1. 验证比赛存在
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null) {
            throw new BizException(ErrorCode.NOT_FOUND, "比赛不存在");
        }

        // 2. 验证当前时间。比赛结束后是否允许继续提交由后台配置控制，赛后提交不计入排名。
        LocalDateTime now = LocalDateTime.now();
        if (now.isBefore(contest.startTime)) {
            throw new BizException(ErrorCode.FORBIDDEN, "比赛尚未开始");
        }
        if (now.isAfter(contest.endTime) && !Boolean.TRUE.equals(contest.allowAfterEndSubmit)) {
            throw new BizException(ErrorCode.FORBIDDEN, "比赛已结束");
        }

        // 3. 验证题目属于该比赛
        ContestProblem contestProblem = resolveContestProblem(contestId, submittedProblemId);
        if (contestProblem == null) {
            throw new BizException(ErrorCode.BAD_REQUEST, "该题不属于当前比赛");
        }

        // 4. 验证用户已报名
        ContestRegistration registration = registrationForUser(contestId, userId);
        if (registration == null) {
            throw new BizException(ErrorCode.FORBIDDEN, "请先报名比赛");
        }

        // 5. 验证报名身份有效
        IdentityType type;
        try {
            type = IdentityType.valueOf(registration.identityType);
        } catch (Exception ex) {
            throw new BizException(ErrorCode.BAD_REQUEST, "报名身份数据异常，请重新报名");
        }
        resolveRegistrationIdentity(contest, type, registration.identityId, userId);
        ensureParticipant(contest, registration);

        return contestProblem;
    }

    public ContestParticipant participantForUser(Long contestId, Long userId) {
        if (contestId == null || userId == null) {
            return null;
        }
        ContestParticipant participant = participantMapper.selectOne(
            new QueryWrapper<ContestParticipant>()
                .eq("contest_id", contestId)
                .eq("user_id", userId)
                .last("LIMIT 1")
        );
        if (participant != null) {
            return participant;
        }
        Contest contest = contestMapper.selectById(contestId);
        ContestRegistration registration = registrationForUser(contestId, userId);
        if (contest == null || registration == null) {
            return null;
        }
        return ensureParticipant(contest, registration);
    }

    private ContestParticipant ensureParticipant(Contest contest, ContestRegistration registration) {
        if (contest == null || registration == null) {
            return null;
        }
        ContestParticipant participant = participantMapper.selectOne(
            new QueryWrapper<ContestParticipant>()
                .eq("contest_id", registration.contestId)
                .eq("user_id", registration.userId)
                .last("LIMIT 1")
        );
        if (participant == null) {
            participant = new ContestParticipant();
            participant.contestId = registration.contestId;
            participant.userId = registration.userId;
            participant.participantType = "INDIVIDUAL";
            participant.status = "NORMAL";
            participant.createdAt = LocalDateTime.now();
        }
        fillParticipant(participant, registration);
        if (participant.id == null) {
            participantMapper.insert(participant);
        } else {
            participantMapper.updateById(participant);
        }
        return participant;
    }

    private void upsertParticipant(Contest contest, ContestRegistration registration) {
        ensureParticipant(contest, registration);
    }

    private void fillParticipant(ContestParticipant participant, ContestRegistration registration) {
        participant.nickname = registration.displayName == null || registration.displayName.isBlank()
            ? registration.username
            : registration.displayName;
        participant.identityType = registration.identityType;
        participant.identityId = registration.identityId;
        participant.starred = Boolean.TRUE.equals(registration.starred);
        participant.registeredAt = registration.registeredAt == null ? LocalDateTime.now() : registration.registeredAt;
    }

    public ContestRegistration registrationForUser(Long contestId, Long userId) {
        if (contestId == null || userId == null) {
            return null;
        }
        return registrationMapper.selectOne(
            new QueryWrapper<ContestRegistration>()
                .eq("contest_id", contestId)
                .eq("user_id", userId)
                .orderByDesc("registered_at")
                .last("LIMIT 1")
        );
    }

    public ContestProblem resolveContestProblem(Long contestId, Long submittedProblemId) {
        if (contestId == null || submittedProblemId == null) {
            return null;
        }
        ContestProblem bySnapshotId = contestProblemMapper.selectOne(
            new QueryWrapper<ContestProblem>().eq("contest_id", contestId).eq("id", submittedProblemId)
        );
        if (bySnapshotId != null) {
            return bySnapshotId;
        }
        return contestProblemMapper.selectOne(
            new QueryWrapper<ContestProblem>()
                .eq("contest_id", contestId)
                .eq("problem_id", submittedProblemId)
                .last("LIMIT 1")
        );
    }

    private ContestRegistration currentRegistration(Long contestId) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUser authUser) || authUser.adminAccount()) {
            return null;
        }
        return registrationForUser(contestId, authUser.id());
    }

    private Long registrationCount(Long contestId) {
        return registrationMapper.selectCount(
            new QueryWrapper<ContestRegistration>().eq("contest_id", contestId)
        );
    }

    private Long participantCount(Long contestId) {
        return registrationMapper.selectCount(
            new QueryWrapper<ContestRegistration>()
                .eq("contest_id", contestId)
                .eq("status", "APPROVED")
                .eq("starred", false)
        );
    }

    private ContestVO toVO(Contest contest) {
        // 判断当前用户是否可以查看题目详情
        AuthUser user = CurrentUser.get();
        boolean canViewProblems = canCurrentUserViewContestProblemDetail(user, contest);

        // 只有在可以查看题目时才返回题目列表，否则返回空列表
        List<ContestProblem> contestProblems = canViewProblems
            ? contestProblemMapper.selectList(new QueryWrapper<ContestProblem>().eq("contest_id", contest.id).orderByAsc("display_order"))
            : List.of();

        // 批量查询每题的提交数和通过数
        java.util.Map<Long, Long> submissionCountMap = new java.util.HashMap<>();
        java.util.Map<Long, Long> acceptedCountMap = new java.util.HashMap<>();
        if (!contestProblems.isEmpty()) {
            List<Submission> allSubmissions = submissionMapper.selectList(
                new QueryWrapper<Submission>().eq("contest_id", contest.id).select("contest_problem_id", "status")
            );
            for (Submission s : allSubmissions) {
                Long cpId = s.contestProblemId;
                if (cpId == null) continue;
                submissionCountMap.merge(cpId, 1L, Long::sum);
                if ("AC".equals(s.status) || "ACCEPTED".equals(s.status)) {
                    acceptedCountMap.merge(cpId, 1L, Long::sum);
                }
            }
        }

        List<ContestProblemVO> problems = contestProblems.stream()
            .map(item -> toProblemVO(item, submissionCountMap, acceptedCountMap))
            .toList();

        List<ContestAudienceVO> audiences = contestAudienceMapper
            .selectList(new QueryWrapper<ContestAudience>().eq("contest_id", contest.id))
            .stream()
            .map(this::toAudienceVO)
            .toList();
        ContestRegistration currentRegistration = currentRegistration(contest.id);
        return new ContestVO(
            contest.id,
            contest.title,
            contest.description,
            contest.durationMinutes == null ? durationMinutes(null, contest.startTime, contest.endTime) : contest.durationMinutes,
            contest.startTime,
            contest.endTime,
            contest.type,
            contest.ownerId,
            ownerName(contest.ownerId, contest.ownerAccountType),
            contest.audience,
            contest.audienceId,
            audiences,
            contest.frozen,
            contest.freezeTime,
            Boolean.TRUE.equals(contest.enableRollingScoreboard),
            ratioOrDefault(contest.goldRatio, DEFAULT_GOLD_RATIO),
            ratioOrDefault(contest.silverRatio, DEFAULT_SILVER_RATIO),
            ratioOrDefault(contest.bronzeRatio, DEFAULT_BRONZE_RATIO),
            contest.allowFullscreen,
            contest.antiCheatEnabled,
            contest.maxSwitches,
            Boolean.TRUE.equals(contest.allowAfterEndSubmit),
            contest.allowAfterEndViewProblem == null || Boolean.TRUE.equals(contest.allowAfterEndViewProblem),
            Boolean.TRUE.equals(contest.allowAfterEndViewCode),
            contest.publicScoreboardEnabled == null || Boolean.TRUE.equals(contest.publicScoreboardEnabled),
            Boolean.TRUE.equals(contest.showClassOnScoreboard),
            contest.allowViewAllSubmissions == null || Boolean.TRUE.equals(contest.allowViewAllSubmissions),
            Boolean.TRUE.equals(contest.allowStarRegistration),
            contest.registrationType,
            hasRegistrationPassword(contest),
            effectiveStatus(contest).name(),
            registrationCount(contest.id),
            participantCount(contest.id),
            submissionMapper.selectCount(new QueryWrapper<Submission>().eq("contest_id", contest.id)),
            problems,
            currentRegistration != null,
            currentRegistration == null ? null : currentRegistration.identityType,
            currentRegistration == null ? null : currentRegistration.identityId,
            currentRegistration == null ? null : identityName(currentRegistration.identityType, currentRegistration.identityId),
            currentRegistration != null && Boolean.TRUE.equals(currentRegistration.starred)
        );
    }

    private ContestProblemVO toProblemVO(ContestProblem item, java.util.Map<Long, Long> submissionCountMap, java.util.Map<Long, Long> acceptedCountMap) {
        List<ContestProblemCaseScoreVO> caseScores = caseScoreMapper
            .selectList(
                new QueryWrapper<ContestProblemCaseScore>()
                    .eq("contest_id", item.contestId)
                    .eq("problem_id", item.id)
                    .orderByAsc("case_no")
            )
            .stream()
            .map(score -> new ContestProblemCaseScoreVO(score.caseNo, score.score))
            .toList();
        return new ContestProblemVO(
            item.id,
            item.problemId,
            item.title,
            item.label,
            item.score,
            item.displayOrder,
            caseScores,
            submissionCountMap.getOrDefault(item.id, 0L),
            acceptedCountMap.getOrDefault(item.id, 0L)
        );
    }

    private ProblemVO toProblemDetailVO(ContestProblem item) {
        Long hiddenCaseCount = contestProblemTestCaseMapper.selectCount(
            new QueryWrapper<ContestProblemTestCase>()
                .eq("contest_problem_id", item.id)
                .eq("sample", false)
        );
        List<ProblemSampleCaseVO> samples = contestProblemTestCaseMapper
            .selectList(
                new QueryWrapper<ContestProblemTestCase>()
                    .eq("contest_problem_id", item.id)
                    .eq("sample", true)
                    .orderByAsc("case_no")
            )
            .stream()
            .map(testCase -> new ProblemSampleCaseVO(testCase.caseNo, testCase.inputData, testCase.outputData, testCase.explanation))
            .toList();
        return new ProblemVO(
            item.id,
            item.title,
            item.statement,
            item.inputFormat,
            item.outputFormat,
            item.sampleCases,
            item.timeLimit,
            item.memoryLimit,
            item.difficulty == null ? 1 : item.difficulty,
            readTags(item.tags),
            null,
            true,
            item.domjudgeProblemId,
            java.math.BigDecimal.ZERO,
            item.createdAt,
            item.updatedAt,
            samples,
            hiddenCaseCount,
            "比赛题库",
            null
        );
    }

    private List<String> readTags(String tags) {
        if (tags == null || tags.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(tags, new TypeReference<List<String>>() {});
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private ContestAudienceVO toAudienceVO(ContestAudience audience) {
        return new ContestAudienceVO(audience.audienceType, audience.audienceId, audienceName(audience));
    }

    private String audienceName(ContestAudience audience) {
        if (AudienceType.ALL.name().equals(audience.audienceType) || audience.audienceId == null || audience.audienceId == 0) {
            return "所有人";
        }
        ClassRoom classRoom = classRoomMapper.selectById(audience.audienceId);
        return classRoom == null ? String.valueOf(audience.audienceId) : classRoom.name;
    }


    private List<ContestScoreboardRowVO> acmScoreboardRows(
        Contest contest,
        List<ContestProblem> contestProblems,
        List<Submission> submissions
    ) {
        Map<BoardIdentity, Map<Long, AcmCell>> cellsByIdentity = new LinkedHashMap<>();
        for (Submission submission : submissions) {
            BoardIdentity identity = identityFromSubmission(contest.id, submission);
            Map<Long, AcmCell> cells = cellsByIdentity.computeIfAbsent(identity, ignored -> new LinkedHashMap<>());
            AcmCell cell = cells.computeIfAbsent(contestProblemKey(submission), ignored -> new AcmCell());
            if (cell.accepted) {
                continue;
            }
            cell.attempts += 1;
            if ("AC".equals(submission.status)) {
                cell.accepted = true;
                cell.acceptedAt = submissionTime(submission);
                cell.penalty = penaltyMinutes(contest, submission) + Math.max(0, cell.attempts - 1) * 20;
            }
        }
        List<ContestScoreboardRowVO> rows = cellsByIdentity.entrySet().stream()
            .map(entry -> acmScoreboardRow(contestProblems, entry.getKey(), entry.getValue()))
            .sorted(Comparator.comparing((ContestScoreboardRowVO row) -> Boolean.TRUE.equals(row.starred()))
                .thenComparing(ContestScoreboardRowVO::solved, Comparator.reverseOrder())
                .thenComparing(ContestScoreboardRowVO::penalty)
                .thenComparing(ContestScoreboardRowVO::userId))
            .toList();
        return rankRows(rows);
    }

    private ContestScoreboardRowVO acmScoreboardRow(
        List<ContestProblem> contestProblems,
        BoardIdentity identity,
        Map<Long, AcmCell> cellsByProblem
    ) {
        List<ContestScoreboardCellVO> cells = contestProblems.stream()
            .map(problem -> {
                AcmCell cell = cellsByProblem.get(problem.id);
                return new ContestScoreboardCellVO(
                    problem.id,
                    problem.label,
                    cell == null ? 0 : cell.attempts,
                    cell != null && cell.accepted,
                    cell == null ? 0 : cell.penalty,
                    cell != null && cell.accepted ? 1 : 0,
                    cell == null ? null : cell.acceptedAt
                );
            })
            .toList();
        int solved = (int) cells.stream().filter(cell -> Boolean.TRUE.equals(cell.accepted())).count();
        int penalty = cells.stream().mapToInt(cell -> cell.penalty() == null ? 0 : cell.penalty()).sum();
        LocalDateTime lastAcceptedAt = cells.stream()
            .map(ContestScoreboardCellVO::acceptedAt)
            .filter(value -> value != null)
            .max(LocalDateTime::compareTo)
            .orElse(null);
        return new ContestScoreboardRowVO(
            null,
            identity.rowId(),
            identity.name(),
            solved,
            penalty,
            solved * 100,
            lastAcceptedAt,
            cells,
            identity.type().name(),
            identity.id(),
            identity.starred(),
            null,
            null,
            null
        );
    }

    private List<ContestScoreboardRowVO> oiScoreboardRows(
        Contest contest,
        List<ContestProblem> contestProblems,
        List<Submission> submissions
    ) {
        Map<BoardIdentity, Map<Long, OiCell>> cellsByIdentity = new LinkedHashMap<>();
        for (Submission submission : submissions) {
            BoardIdentity identity = identityFromSubmission(contest.id, submission);
            Map<Long, OiCell> cells = cellsByIdentity.computeIfAbsent(identity, ignored -> new LinkedHashMap<>());
            OiCell cell = cells.computeIfAbsent(contestProblemKey(submission), ignored -> new OiCell());
            cell.attempts += 1;
            int score = oiSubmissionScore(contest.id, submission);
            if (score >= cell.score) {
                cell.score = score;
                cell.accepted = "AC".equals(submission.status);
                cell.acceptedAt = cell.accepted ? submissionTime(submission) : cell.acceptedAt;
            }
        }
        List<ContestScoreboardRowVO> rows = cellsByIdentity.entrySet().stream()
            .map(entry -> oiScoreboardRow(contestProblems, entry.getKey(), entry.getValue()))
            .sorted(Comparator.comparing((ContestScoreboardRowVO row) -> Boolean.TRUE.equals(row.starred()))
                .thenComparing(ContestScoreboardRowVO::score, Comparator.reverseOrder())
                .thenComparing(ContestScoreboardRowVO::solved, Comparator.reverseOrder())
                .thenComparing(ContestScoreboardRowVO::userId))
            .toList();
        return rankRows(rows);
    }

    private ContestScoreboardRowVO oiScoreboardRow(
        List<ContestProblem> contestProblems,
        BoardIdentity identity,
        Map<Long, OiCell> cellsByProblem
    ) {
        List<ContestScoreboardCellVO> cells = contestProblems.stream()
            .map(problem -> {
                OiCell cell = cellsByProblem.get(problem.id);
                int fullScore = problem.score == null ? 0 : problem.score;
                int score = cell == null ? 0 : cell.score;
                return new ContestScoreboardCellVO(
                    problem.id,
                    problem.label,
                    cell == null ? 0 : cell.attempts,
                    fullScore > 0 && score >= fullScore,
                    0,
                    score,
                    cell == null ? null : cell.acceptedAt
                );
            })
            .toList();
        int score = cells.stream().mapToInt(cell -> cell.score() == null ? 0 : cell.score()).sum();
        int solved = (int) cells.stream().filter(cell -> Boolean.TRUE.equals(cell.accepted()) || (cell.score() != null && cell.score() > 0)).count();
        LocalDateTime lastAcceptedAt = cells.stream()
            .map(ContestScoreboardCellVO::acceptedAt)
            .filter(value -> value != null)
            .max(LocalDateTime::compareTo)
            .orElse(null);
        return new ContestScoreboardRowVO(
            null,
            identity.rowId(),
            identity.name(),
            solved,
            0,
            score,
            lastAcceptedAt,
            cells,
            identity.type().name(),
            identity.id(),
            identity.starred(),
            null,
            null,
            null
        );
    }

    private List<ContestScoreboardRowVO> rankRows(List<ContestScoreboardRowVO> rows) {
        java.util.ArrayList<ContestScoreboardRowVO> ranked = new java.util.ArrayList<>();
        int rank = 1;
        for (ContestScoreboardRowVO row : rows) {
            Integer rowRank = Boolean.TRUE.equals(row.starred()) ? null : rank++;
            ranked.add(new ContestScoreboardRowVO(
                rowRank,
                row.userId(),
                row.displayName(),
                row.solved(),
                row.penalty(),
                row.score(),
                row.lastAcceptedAt(),
                row.cells(),
                row.identityType(),
                row.identityId(),
                row.starred(),
                row.medal(),
                row.classId(),
                row.className()
            ));
        }
        return ranked;
    }

    private List<ContestScoreboardRowVO> applyMedals(List<ContestScoreboardRowVO> rows, Contest contest, boolean showMedals) {
        if (!showMedals || rows == null || rows.isEmpty()) {
            return rows;
        }
        int total = (int) rows.stream().filter(row -> !Boolean.TRUE.equals(row.starred())).count();
        int goldCount = medalCount(total, ratioOrDefault(contest.goldRatio, DEFAULT_GOLD_RATIO));
        int silverCount = medalCount(total, ratioOrDefault(contest.silverRatio, DEFAULT_SILVER_RATIO));
        int bronzeCount = medalCount(total, ratioOrDefault(contest.bronzeRatio, DEFAULT_BRONZE_RATIO));
        int goldLimit = Math.min(total, goldCount);
        int silverLimit = Math.min(total, goldLimit + silverCount);
        int bronzeLimit = Math.min(total, silverLimit + bronzeCount);
        List<ContestScoreboardRowVO> result = new ArrayList<>();
        for (ContestScoreboardRowVO row : rows) {
            String medal = Boolean.TRUE.equals(row.starred()) ? null : medalForRank(row.rank(), goldLimit, silverLimit, bronzeLimit);
            result.add(withMedal(row, medal));
        }
        return result;
    }

    private ContestScoreboardRowVO withMedal(ContestScoreboardRowVO row, String medal) {
        return new ContestScoreboardRowVO(
            row.rank(),
            row.userId(),
            row.displayName(),
            row.solved(),
            row.penalty(),
            row.score(),
            row.lastAcceptedAt(),
            row.cells(),
            row.identityType(),
            row.identityId(),
            row.starred(),
            medal,
            row.classId(),
            row.className()
        );
    }

    private List<ContestScoreboardRowVO> enrichScoreboardClassInfo(Contest contest, List<ContestScoreboardRowVO> rows) {
        if (!Boolean.TRUE.equals(contest.showClassOnScoreboard) || rows == null || rows.isEmpty()) {
            return rows;
        }

        Set<Long> userIds = new HashSet<>();
        for (ContestScoreboardRowVO row : rows) {
            if (row.userId() != null) {
                userIds.add(row.userId());
            }
        }
        if (userIds.isEmpty()) {
            return rows;
        }

        Map<Long, Long> classIdByUserId = new HashMap<>();
        List<User> users = userMapper.selectBatchIds(userIds);
        for (User user : users) {
            if (user != null && user.id != null && user.classId != null) {
                classIdByUserId.put(user.id, user.classId);
            }
        }

        Set<Long> missingUserIds = new HashSet<>(userIds);
        missingUserIds.removeAll(classIdByUserId.keySet());
        if (!missingUserIds.isEmpty()) {
            List<ClassMember> members = classMemberMapper.selectList(new QueryWrapper<ClassMember>().in("user_id", missingUserIds));
            for (ClassMember member : members) {
                if (member != null && member.userId != null && member.classId != null) {
                    classIdByUserId.putIfAbsent(member.userId, member.classId);
                }
            }
        }

        Set<Long> classIds = new HashSet<>();
        for (Long classId : classIdByUserId.values()) {
            if (classId != null) {
                classIds.add(classId);
            }
        }
        Map<Long, String> classNameById = new HashMap<>();
        if (!classIds.isEmpty()) {
            List<ClassRoom> classes = classRoomMapper.selectBatchIds(classIds);
            for (ClassRoom classRoom : classes) {
                if (classRoom != null && classRoom.id != null) {
                    classNameById.put(classRoom.id, classRoom.name);
                }
            }
        }

        List<ContestScoreboardRowVO> result = new ArrayList<>();
        for (ContestScoreboardRowVO row : rows) {
            Long classId = classIdByUserId.get(row.userId());
            result.add(withClassInfo(row, classId, classId == null ? null : classNameById.get(classId)));
        }
        return result;
    }

    private ContestScoreboardRowVO withClassInfo(ContestScoreboardRowVO row, Long classId, String className) {
        return new ContestScoreboardRowVO(
            row.rank(),
            row.userId(),
            row.displayName(),
            row.solved(),
            row.penalty(),
            row.score(),
            row.lastAcceptedAt(),
            row.cells(),
            row.identityType(),
            row.identityId(),
            row.starred(),
            row.medal(),
            classId,
            className
        );
    }

    private int medalCount(int total, BigDecimal ratio) {
        if (total <= 0 || ratio == null || ratio.signum() <= 0) {
            return 0;
        }
        return BigDecimal.valueOf(total)
            .multiply(ratio)
            .divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP)
            .setScale(0, RoundingMode.CEILING)
            .intValue();
    }

    private String medalForRank(Integer rank, int goldLimit, int silverLimit, int bronzeLimit) {
        if (rank == null) {
            return null;
        }
        if (rank <= goldLimit) {
            return "GOLD";
        }
        if (rank <= silverLimit) {
            return "SILVER";
        }
        if (rank <= bronzeLimit) {
            return "BRONZE";
        }
        return null;
    }

    private StandingAccumulator emptyStanding(Long contestId, BoardIdentity identity) {
        StandingAccumulator standing = new StandingAccumulator();
        standing.contestId = contestId;
        standing.identity = identity;
        standing.solved = 0;
        standing.penalty = 0;
        standing.score = 0;
        return standing;
    }

    private BoardIdentity identityFromSubmission(Long contestId, Submission submission) {
        ContestParticipant participant = submission.participantId == null ? null : participantMapper.selectById(submission.participantId);
        Boolean starred = participant != null && Boolean.TRUE.equals(participant.starred);
        return identityKey(IdentityType.PERSONAL, submission.userId, starred);
    }

    private BoardIdentity identityKey(String type, Long id) {
        IdentityType identityType;
        try {
            identityType = IdentityType.valueOf(type);
        } catch (Exception ignored) {
            identityType = IdentityType.PERSONAL;
        }
        return identityKey(identityType, id);
    }

    private BoardIdentity identityKey(IdentityType type, Long id) {
        return identityKey(type, id, false);
    }

    private BoardIdentity identityKey(IdentityType type, Long id, Boolean starred) {
        Long safeId = id == null ? 0L : id;
        return new BoardIdentity(type, safeId, identityName(type.name(), safeId), Boolean.TRUE.equals(starred));
    }

    private String identityName(String type, Long id) {
        User user = userMapper.selectById(id);
        return user == null ? String.valueOf(id) : user.displayName;
    }

    private int oiSubmissionScore(Long contestId, Submission submission) {
        if ("AC".equals(submission.status)) {
            ContestProblem problem = resolveContestProblem(contestId, contestProblemKey(submission));
            return problem == null || problem.score == null ? 0 : problem.score;
        }
        List<SubmissionCaseResult> cases = submissionCaseResultMapper.selectList(
            new QueryWrapper<SubmissionCaseResult>().eq("submission_id", submission.id)
        );
        if (cases.isEmpty()) {
            return 0;
        }
        Map<Integer, Integer> scoreByCase = new HashMap<>();
        caseScoreMapper
            .selectList(
                new QueryWrapper<ContestProblemCaseScore>()
                    .eq("contest_id", contestId)
                    .eq("problem_id", contestProblemKey(submission))
            )
            .forEach(item -> scoreByCase.put(item.caseNo, item.score == null ? 0 : item.score));
        int score = 0;
        for (SubmissionCaseResult item : cases) {
            if ("AC".equals(item.status)) {
                score += scoreByCase.getOrDefault(item.caseNo, 0);
            }
        }
        return score;
    }

    private Long contestProblemKey(Submission submission) {
        return submission.contestProblemId == null ? submission.problemId : submission.contestProblemId;
    }

    private int penaltyMinutes(Contest contest, Submission submission) {
        LocalDateTime submittedAt = submissionTime(submission);
        if (contest.startTime == null || submittedAt == null) {
            return 0;
        }
        return Math.max(0, (int) java.time.Duration.between(contest.startTime, submittedAt).toMinutes());
    }

    private boolean isRankedSubmission(Contest contest, Submission submission) {
        return isRankedSubmission(contest, submission, null);
    }

    private boolean isRankedSubmission(Contest contest, Submission submission, LocalDateTime cutoff) {
        LocalDateTime submittedAt = submissionTime(submission);
        if (contest == null || submission == null || submittedAt == null || contest.startTime == null || contest.endTime == null) {
            return false;
        }
        if (submittedAt.isBefore(contest.startTime) || submittedAt.isAfter(contest.endTime)) {
            return false;
        }
        return cutoff == null || !submittedAt.isAfter(cutoff);
    }

    private LocalDateTime submissionTime(Submission submission) {
        return submission == null ? null : (submission.submitTime == null ? submission.createdAt : submission.submitTime);
    }

    private ContestStatus effectiveStatus(Contest contest) {
        if (contest == null || contest.startTime == null || contest.endTime == null) {
            return ContestStatus.NOT_STARTED;
        }
        return calculateStatus(contest.startTime, contest.endTime);
    }

    private Integer durationMinutes(Integer durationMinutes, LocalDateTime startTime, LocalDateTime endTime) {
        if (durationMinutes != null) {
            return durationMinutes;
        }
        if (startTime == null || endTime == null) {
            return 0;
        }
        return Math.max(0, (int) java.time.Duration.between(startTime, endTime).toMinutes());
    }

    private BigDecimal normalizeRatio(BigDecimal ratio, BigDecimal fallback) {
        BigDecimal value = ratio == null ? fallback : ratio;
        if (value == null) {
            return BigDecimal.ZERO;
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal ratioOrDefault(BigDecimal ratio, BigDecimal fallback) {
        return ratio == null ? fallback : ratio;
    }

    private void validateFreezeAndRollingSettings(Contest contest) {
        if (contest.startTime == null || contest.endTime == null) {
            return;
        }
        if (!contest.endTime.isAfter(contest.startTime)) {
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "比赛结束时间必须晚于开始时间");
        }
        if (!Boolean.TRUE.equals(contest.frozen) && Boolean.TRUE.equals(contest.enableRollingScoreboard)) {
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "启用滚榜需要先开启封榜并设置封榜时间");
        }
        if (Boolean.TRUE.equals(contest.frozen)) {
            if (contest.freezeTime == null) {
                throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "开启封榜后必须设置封榜时间");
            }
            if (contest.freezeTime.isBefore(contest.startTime) || contest.freezeTime.isAfter(contest.endTime)) {
                throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "封榜时间必须在比赛开始和结束时间之间");
            }
        } else {
            contest.freezeTime = null;
            contest.enableRollingScoreboard = false;
        }
        if (Boolean.TRUE.equals(contest.enableRollingScoreboard) && (!Boolean.TRUE.equals(contest.frozen) || contest.freezeTime == null)) {
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "启用滚榜需要先开启封榜并设置封榜时间");
        }
        contest.goldRatio = normalizeRatio(contest.goldRatio, DEFAULT_GOLD_RATIO);
        contest.silverRatio = normalizeRatio(contest.silverRatio, DEFAULT_SILVER_RATIO);
        contest.bronzeRatio = normalizeRatio(contest.bronzeRatio, DEFAULT_BRONZE_RATIO);
        validateMedalRatio(contest.goldRatio, "金牌比例");
        validateMedalRatio(contest.silverRatio, "银牌比例");
        validateMedalRatio(contest.bronzeRatio, "铜牌比例");
        if (contest.goldRatio.compareTo(contest.silverRatio) > 0 || contest.silverRatio.compareTo(contest.bronzeRatio) > 0) {
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), "奖牌比例必须满足 金牌 ≤ 银牌 ≤ 铜牌");
        }
    }

    private void validateMedalRatio(BigDecimal ratio, String label) {
        if (ratio.compareTo(BigDecimal.ZERO) < 0 || ratio.compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new BizException(ErrorCode.BAD_REQUEST.getCode(), label + "必须在 0 到 100 之间");
        }
    }

    private boolean isActiveFreeze(Contest contest) {
        LocalDateTime now = LocalDateTime.now();
        return Boolean.TRUE.equals(contest.frozen)
            && contest.freezeTime != null
            && contest.endTime != null
            && !now.isBefore(contest.freezeTime)
            && now.isBefore(contest.endTime);
    }

    private boolean isEnded(Contest contest) {
        return contest != null && contest.endTime != null && LocalDateTime.now().isAfter(contest.endTime);
    }

    private String encodeRegistrationPassword(String password) {
        if (password == null) {
            return null;
        }
        String trimmed = password.trim();
        return trimmed.isEmpty() ? null : passwordEncoder.encode(trimmed);
    }

    private void verifyRegistrationPassword(Contest contest, String password) {
        if (!hasRegistrationPassword(contest)) {
            return;
        }
        if (password == null || password.isBlank() || !passwordEncoder.matches(password.trim(), contest.registrationPassword)) {
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "比赛密码错误");
        }
    }

    private boolean hasRegistrationPassword(Contest contest) {
        return contest.registrationPassword != null && !contest.registrationPassword.isBlank();
    }

    private String ownerName(Long ownerId, String ownerAccountType) {
        if ("ADMIN".equals(ownerAccountType)) {
            AdminUser adminUser = adminUserMapper.selectById(ownerId);
            return adminUser == null ? String.valueOf(ownerId) : adminUser.displayName;
        }
        User user = userMapper.selectById(ownerId);
        if (user != null) {
            return user.displayName;
        }
        AdminUser adminUser = adminUserMapper.selectById(ownerId);
        return adminUser == null ? String.valueOf(ownerId) : adminUser.displayName;
    }

    private ContestStatus calculateStatus(LocalDateTime startTime, LocalDateTime endTime) {
        LocalDateTime now = LocalDateTime.now();
        if (now.isBefore(startTime)) {
            return ContestStatus.NOT_STARTED;
        }
        if (now.isAfter(endTime)) {
            return ContestStatus.ENDED;
        }
        return ContestStatus.RUNNING;
    }

    private String contestDraftKey() {
        var user = CurrentUser.required();
        return RedisKeys.contestDraft(user.adminAccount() ? "admin" : "user", user.id());
    }

    private static class AcmCell {
        int attempts;
        boolean accepted;
        int penalty;
        LocalDateTime acceptedAt;
    }

    private static class OiCell {
        int attempts;
        boolean accepted;
        int score;
        LocalDateTime acceptedAt;
    }

    private record RegistrationIdentity(IdentityType type, Long id) {
    }

    private record BoardIdentity(IdentityType type, Long id, String name, Boolean starred) {
        Long rowId() {
            return id;
        }

        String value() {
            return type.name() + ":" + id;
        }
    }

    private static class StandingAccumulator {
        Long contestId;
        BoardIdentity identity;
        int solved;
        int penalty;
        LocalDateTime lastAcTime;
        int score;
        Map<Long, Integer> attempts = new HashMap<>();
        Map<Long, Boolean> acceptedProblems = new HashMap<>();
    }

    /**
     * 软删除比赛
     */
    @Transactional
    public void delete(long id) {
        Contest contest = contestMapper.selectById(id);
        if (contest == null) {
            throw new BizException(ErrorCode.NOT_FOUND, "比赛不存在");
        }

        // 软删除
        contest.isDeleted = true;
        contest.deletedAt = LocalDateTime.now();
        contestMapper.updateById(contest);
    }

    /**
     * 更新比赛统计信息（报名人数、参赛人数）
     */
    private void updateContestStats(long contestId) {
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null) {
            return;
        }

        // 统计报名人数
        Long registrationCount = registrationMapper.selectCount(
            new QueryWrapper<ContestRegistration>().eq("contest_id", contestId)
        );

        // 统计参赛人数（有效报名）
        Long participantCount = registrationMapper.selectCount(
            new QueryWrapper<ContestRegistration>()
                .eq("contest_id", contestId)
                .eq("status", "APPROVED")
        );

        contest.registrationCount = registrationCount.intValue();
        contest.participantCount = participantCount.intValue();
        contestMapper.updateById(contest);
    }

    /**
     * 获取比赛公开榜单数据（无需登录）
     */
    public com.qoj.module.contest.vo.PublicScoreboardVO getPublicScoreboard(long contestId) {
        Contest contest = contestMapper.selectById(contestId);
        if (contest == null || Boolean.TRUE.equals(contest.isDeleted)) {
            throw new BizException(ErrorCode.NOT_FOUND, "比赛不存在");
        }
        if (Boolean.FALSE.equals(contest.publicScoreboardEnabled)) {
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "公共榜单已关闭");
        }

        boolean rollingCandidate = isEnded(contest)
            && Boolean.TRUE.equals(contest.enableRollingScoreboard)
            && Boolean.TRUE.equals(contest.frozen)
            && contest.freezeTime != null;
        ContestRollingState rollingState = rollingCandidate ? safeRollingState(contest.id) : null;
        boolean rollingPublished = rollingState != null && "PUBLISHED".equals(rollingState.status);
        boolean waitingForRolling = rollingCandidate && !rollingPublished;

        ContestScoreboardVO scoreboard;
        String boardState;
        boolean rollingView = false;
        Set<String> revealedKeys = Set.of();
        Map<String, Integer> frozenRanks = Map.of();
        Map<String, Integer> finalRanks = Map.of();
        Map<String, List<com.qoj.module.contest.vo.PublicScoreboardVO.SubmissionHistory>> historyByUserProblem;
        Map<String, List<com.qoj.module.contest.vo.PublicScoreboardVO.SubmissionHistory>> frozenHistoryByUserProblem = Map.of();
        Map<String, List<com.qoj.module.contest.vo.PublicScoreboardVO.SubmissionHistory>> finalHistoryByUserProblem = Map.of();

        if (isActiveFreeze(contest)) {
            boardState = "FROZEN";
            scoreboard = buildScoreboard(contest, contest.freezeTime, false);
            historyByUserProblem = publicScoreboardHistory(contest, contest.freezeTime);
        } else if (waitingForRolling) {
            boardState = "ROLLING";
            rollingView = true;
            ContestScoreboardVO frozenScoreboard = buildScoreboard(contest, contest.freezeTime, false);
            ContestScoreboardVO finalScoreboard = buildScoreboard(contest, null, true);
            revealedKeys = revealedRollingKeys(rollingState);
            frozenRanks = rankByIdentity(frozenScoreboard);
            finalRanks = rankByIdentity(finalScoreboard);
            scoreboard = rollingCompositeScoreboard(frozenScoreboard, finalScoreboard, revealedKeys);
            frozenHistoryByUserProblem = publicScoreboardHistory(contest, contest.freezeTime);
            finalHistoryByUserProblem = publicScoreboardHistory(contest, null);
            historyByUserProblem = frozenHistoryByUserProblem;
        } else if (isEnded(contest)) {
            boardState = "FINAL";
            scoreboard = buildScoreboard(contest, null, true);
            historyByUserProblem = publicScoreboardHistory(contest, null);
        } else {
            boardState = "LIVE";
            scoreboard = buildScoreboard(contest, null, false);
            historyByUserProblem = publicScoreboardHistory(contest, null);
        }

        com.qoj.module.contest.vo.PublicScoreboardVO vo = new com.qoj.module.contest.vo.PublicScoreboardVO();
        vo.contestId = contest.id;
        vo.contestTitle = contest.title;
        vo.contestType = contest.type;
        vo.startTime = contest.startTime;
        vo.endTime = contest.endTime;
        vo.frozen = contest.frozen;
        vo.freezeTime = contest.freezeTime;
        vo.boardState = boardState;
        vo.showClassOnScoreboard = scoreboard.showClassOnScoreboard();

        // 问题列表
        vo.problems = scoreboard.problems().stream().map(p -> {
            com.qoj.module.contest.vo.PublicScoreboardVO.ProblemInfo info = new com.qoj.module.contest.vo.PublicScoreboardVO.ProblemInfo();
            info.label = p.label();
            info.title = p.title();
            info.score = p.score();
            return info;
        }).collect(java.util.stream.Collectors.toList());

        vo.rows = toPublicRows(
            contest,
            scoreboard,
            historyByUserProblem,
            frozenHistoryByUserProblem,
            finalHistoryByUserProblem,
            revealedKeys,
            rollingView,
            frozenRanks,
            finalRanks
        );

        return vo;
    }

    private List<com.qoj.module.contest.vo.PublicScoreboardVO.UserRank> toPublicRows(
        Contest contest,
        ContestScoreboardVO scoreboard,
        Map<String, List<com.qoj.module.contest.vo.PublicScoreboardVO.SubmissionHistory>> historyByUserProblem,
        Map<String, List<com.qoj.module.contest.vo.PublicScoreboardVO.SubmissionHistory>> frozenHistoryByUserProblem,
        Map<String, List<com.qoj.module.contest.vo.PublicScoreboardVO.SubmissionHistory>> finalHistoryByUserProblem,
        Set<String> revealedKeys,
        boolean rollingView,
        Map<String, Integer> frozenRanks,
        Map<String, Integer> finalRanks
    ) {
        return scoreboard.rows().stream().map(row -> {
            String identityKey = scoreboardIdentityKey(row);
            boolean revealed = !rollingView || revealedKeys.contains(identityKey);
            Map<String, List<com.qoj.module.contest.vo.PublicScoreboardVO.SubmissionHistory>> rowHistory = rollingView
                ? (revealed ? finalHistoryByUserProblem : frozenHistoryByUserProblem)
                : historyByUserProblem;
            com.qoj.module.contest.vo.PublicScoreboardVO.UserRank userRank = new com.qoj.module.contest.vo.PublicScoreboardVO.UserRank();
            User user = userMapper.selectById(row.userId());
            userRank.rank = row.rank();
            userRank.userId = row.userId();
            userRank.username = user == null ? String.valueOf(row.userId()) : user.username;
            userRank.displayName = row.displayName();
            userRank.classId = row.classId();
            userRank.className = row.className();
            userRank.solved = row.solved();
            userRank.penalty = row.penalty();
            userRank.totalScore = row.score();
            userRank.lastAcTime = row.lastAcceptedAt();
            userRank.medal = revealed ? row.medal() : null;
            userRank.revealed = rollingView ? revealed : null;
            userRank.starred = row.starred();
            userRank.frozenRank = frozenRanks.get(identityKey);
            userRank.finalRank = finalRanks.get(identityKey);
            userRank.problems = new java.util.LinkedHashMap<>();
            for (ContestScoreboardCellVO cell : row.cells()) {
                com.qoj.module.contest.vo.PublicScoreboardVO.ProblemStatus status = new com.qoj.module.contest.vo.PublicScoreboardVO.ProblemStatus();
                status.accepted = cell.accepted();
                status.attempts = cell.attempts();
                status.timeMinutes = cell.acceptedAt() == null || contest.startTime == null
                    ? null
                    : Math.max(0, (int) java.time.Duration.between(contest.startTime, cell.acceptedAt()).toMinutes());
                status.acceptedAt = cell.acceptedAt();
                status.score = cell.score();
                status.history = rowHistory.getOrDefault(publicHistoryKey(row.userId(), cell.problemId()), List.of());
                userRank.problems.put(cell.label(), status);
            }
            return userRank;
        }).collect(java.util.stream.Collectors.toList());
    }

    private ContestScoreboardVO rollingCompositeScoreboard(
        ContestScoreboardVO frozenScoreboard,
        ContestScoreboardVO finalScoreboard,
        Set<String> revealedKeys
    ) {
        Map<String, ContestScoreboardRowVO> finalRows = new LinkedHashMap<>();
        for (ContestScoreboardRowVO row : finalScoreboard.rows()) {
            finalRows.put(scoreboardIdentityKey(row), row);
        }
        Map<String, ContestScoreboardRowVO> displayed = new LinkedHashMap<>();
        for (ContestScoreboardRowVO row : frozenScoreboard.rows()) {
            String key = scoreboardIdentityKey(row);
            displayed.put(key, revealedKeys.contains(key) ? finalRows.getOrDefault(key, row) : row);
        }
        for (ContestScoreboardRowVO row : finalScoreboard.rows()) {
            String key = scoreboardIdentityKey(row);
            if (revealedKeys.contains(key) && !displayed.containsKey(key)) {
                displayed.put(key, row);
            }
        }
        List<ContestScoreboardRowVO> rows = new ArrayList<>(displayed.values());
        rows.sort(Comparator.comparing(row -> row.rank() == null ? Integer.MAX_VALUE : row.rank()));
        return new ContestScoreboardVO(
            finalScoreboard.contestId(),
            finalScoreboard.title(),
            finalScoreboard.type(),
            finalScoreboard.status(),
            finalScoreboard.startTime(),
            finalScoreboard.endTime(),
            finalScoreboard.durationMinutes(),
            finalScoreboard.problems(),
            rows,
            finalScoreboard.showClassOnScoreboard()
        );
    }

    private Set<String> revealedRollingKeys(ContestRollingState rollingState) {
        if (rollingState == null || rollingState.stepsJson == null || rollingState.stepsJson.isBlank()) {
            return Set.of();
        }
        int currentStep = rollingState.currentStep == null ? 0 : Math.max(0, rollingState.currentStep);
        if (currentStep == 0) {
            return Set.of();
        }
        try {
            List<ContestRollingStepVO> steps = objectMapper.readValue(
                rollingState.stepsJson,
                new TypeReference<List<ContestRollingStepVO>>() {}
            );
            Set<String> keys = new HashSet<>();
            for (int i = 0; i < Math.min(currentStep, steps.size()); i++) {
                keys.add(scoreboardIdentityKey(steps.get(i)));
            }
            return keys;
        } catch (Exception ignored) {
            return Set.of();
        }
    }

    private ContestRollingState safeRollingState(Long contestId) {
        try {
            return rollingStateMapper.selectById(contestId);
        } catch (BadSqlGrammarException ex) {
            return null;
        }
    }

    private Map<String, Integer> rankByIdentity(ContestScoreboardVO scoreboard) {
        Map<String, Integer> ranks = new HashMap<>();
        for (ContestScoreboardRowVO row : scoreboard.rows()) {
            ranks.put(scoreboardIdentityKey(row), row.rank());
        }
        return ranks;
    }

    private String scoreboardIdentityKey(ContestScoreboardRowVO row) {
        String type = row.identityType() == null || row.identityType().isBlank() ? IdentityType.PERSONAL.name() : row.identityType();
        Long id = row.identityId() == null ? row.userId() : row.identityId();
        return type + ":" + id;
    }

    private String scoreboardIdentityKey(ContestRollingStepVO step) {
        String type = step.identityType() == null || step.identityType().isBlank() ? IdentityType.PERSONAL.name() : step.identityType();
        Long id = step.identityId() == null ? step.userId() : step.identityId();
        return type + ":" + id;
    }

    private Map<String, List<com.qoj.module.contest.vo.PublicScoreboardVO.SubmissionHistory>> publicScoreboardHistory(Contest contest, LocalDateTime cutoff) {
        Map<String, List<com.qoj.module.contest.vo.PublicScoreboardVO.SubmissionHistory>> histories = new HashMap<>();
        List<Submission> submissions = submissionMapper.selectList(
            new QueryWrapper<Submission>()
                .eq("contest_id", contest.id)
                .orderByAsc("created_at")
                .orderByAsc("id")
        )
            .stream()
            .filter(submission -> isRankedSubmission(contest, submission, cutoff))
            .toList();
        for (Submission submission : submissions) {
            com.qoj.module.contest.vo.PublicScoreboardVO.SubmissionHistory history =
                new com.qoj.module.contest.vo.PublicScoreboardVO.SubmissionHistory();
            history.status = submission.status;
            history.submittedAt = submission.submitTime == null ? submission.createdAt : submission.submitTime;
            history.timeMinutes = history.submittedAt == null || contest.startTime == null
                ? null
                : Math.max(0, (int) java.time.Duration.between(contest.startTime, history.submittedAt).toMinutes());
            histories.computeIfAbsent(publicHistoryKey(submission.userId, contestProblemKey(submission)), ignored -> new ArrayList<>())
                .add(history);
        }
        return histories;
    }

    private String publicHistoryKey(Long userId, Long contestProblemId) {
        return String.valueOf(userId) + ":" + String.valueOf(contestProblemId);
    }
}

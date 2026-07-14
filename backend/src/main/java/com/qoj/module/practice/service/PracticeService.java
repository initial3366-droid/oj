package com.qoj.module.practice.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.qoj.common.ErrorCode;
import com.qoj.common.PageResult;
import com.qoj.common.enums.AudienceType;
import com.qoj.common.enums.SubmissionStatus;
import com.qoj.common.exception.BizException;
import com.qoj.module.practice.dto.PracticeCreateRequest;
import com.qoj.module.practice.entity.Practice;
import com.qoj.module.practice.entity.PracticeProblem;
import com.qoj.module.practice.mapper.PracticeMapper;
import com.qoj.module.practice.mapper.PracticeProblemMapper;
import com.qoj.module.practice.vo.PracticeRankVO;
import com.qoj.module.practice.vo.PracticeReportVO;
import com.qoj.module.practice.vo.PracticeSubmissionVO;
import com.qoj.module.practice.vo.PracticeVO;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.service.ProblemService;
import com.qoj.module.problem.vo.ProblemVO;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.classroom.entity.ClassMember;
import com.qoj.module.classroom.entity.ClassRoom;
import com.qoj.module.classroom.mapper.ClassMemberMapper;
import com.qoj.module.classroom.mapper.ClassRoomMapper;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 练习业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class PracticeService {
    private final PracticeMapper practiceMapper;
    private final PracticeProblemMapper practiceProblemMapper;
    private final ProblemMapper problemMapper;
    private final ProblemService problemService;
    private final SubmissionMapper submissionMapper;
    private final UserMapper userMapper;
    private final ClassRoomMapper classRoomMapper;
    private final ClassMemberMapper classMemberMapper;
    private final PasswordEncoder passwordEncoder;
    private final StringRedisTemplate redisTemplate;
    private final com.qoj.security.policy.PracticeAccessPolicy practiceAccessPolicy;

    /**
     * 构造 练习Service 实例并保存其必要依赖或初始状态。调用前会结合当前登录身份执行权限判断；从持久化层读取数据；读写 Redis 中的缓存、锁或限流状态。
     */
    public PracticeService(
        PracticeMapper practiceMapper,
        PracticeProblemMapper practiceProblemMapper,
        ProblemMapper problemMapper,
        ProblemService problemService,
        SubmissionMapper submissionMapper,
        UserMapper userMapper,
        ClassRoomMapper classRoomMapper,
        ClassMemberMapper classMemberMapper,
        PasswordEncoder passwordEncoder,
        StringRedisTemplate redisTemplate,
        com.qoj.security.policy.PracticeAccessPolicy practiceAccessPolicy
    ) {
        this.practiceMapper = practiceMapper;
        this.practiceProblemMapper = practiceProblemMapper;
        this.problemMapper = problemMapper;
        this.problemService = problemService;
        this.submissionMapper = submissionMapper;
        this.userMapper = userMapper;
        this.classRoomMapper = classRoomMapper;
        this.classMemberMapper = classMemberMapper;
        this.passwordEncoder = passwordEncoder;
        this.redisTemplate = redisTemplate;
        this.practiceAccessPolicy = practiceAccessPolicy;
    }

    public PageResult<PracticeVO> list(int page, int pageSize) {
        /**
         * 查询目标数据列表。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return list(page, pageSize, "all");
    }

    public PageResult<PracticeVO> list(int page, int pageSize, String scope) {
        QueryWrapper<Practice> wrapper = new QueryWrapper<>();
        wrapper.eq("published", true)
            .eq("is_deleted", false);  // 过滤已删除
        AuthUser user = CurrentUser.get();
        String normalizedScope = scope == null || scope.isBlank() ? "all" : scope.trim().toLowerCase();
        if ("public".equals(normalizedScope)) {
            wrapper.eq("audience", AudienceType.ALL.name());
        } else if ("class".equals(normalizedScope)) {
            if (user == null || user.adminAccount()) {
                wrapper.eq("id", -1);
            } else {
                List<Long> classIds = currentUserClassIds(user);
                if (!classIds.isEmpty()) {
                    wrapper.eq("audience", AudienceType.CLASS.name()).in("audience_id", classIds);
                } else {
                    wrapper.eq("id", -1);
                }
            }
        } else if (user == null || user.adminAccount()) {
            wrapper.eq("audience", AudienceType.ALL.name());
        } else {
            List<Long> classIds = currentUserClassIds(user);
            wrapper.and(visibleScope -> {
                visibleScope.eq("audience", AudienceType.ALL.name());
                if (!classIds.isEmpty()) {
                    visibleScope.or(item -> item.eq("audience", AudienceType.CLASS.name()).in("audience_id", classIds));
                }
            });
        }
        wrapper.orderByDesc("created_at");
        Page<Practice> result = practiceMapper.selectPage(Page.of(page, pageSize), wrapper);
        return new PageResult<>(result.getTotal(), result.getRecords().stream().map(this::toVO).toList());
    }

    private List<Long> currentUserClassIds(AuthUser user) {
        List<Long> classIds = new ArrayList<>();
        if (user == null || user.adminAccount()) {
            return classIds;
        }
        User entity = userMapper.selectById(user.id());
        if (entity != null && entity.classId != null) {
            classIds.add(entity.classId);
        }
        List<ClassMember> memberships = classMemberMapper.selectList(
            new QueryWrapper<ClassMember>().eq("user_id", user.id())
        );
        for (ClassMember membership : memberships) {
            if (membership.classId != null && !classIds.contains(membership.classId)) {
                classIds.add(membership.classId);
            }
        }
        return classIds;
    }

    public PageResult<PracticeVO> adminList(int page, int pageSize) {
        AuthUser user = CurrentUser.required();
        QueryWrapper<Practice> wrapper = new QueryWrapper<>();
        // 非超级管理员只能看自己的练习
        if (user != null && !"SUPER_ADMIN".equals(user.role())) {
            wrapper.eq("owner_id", user.id());
        }
        wrapper.eq("is_deleted", false)  // 过滤已删除
            .orderByDesc("created_at");
        Page<Practice> result = practiceMapper.selectPage(Page.of(page, pageSize), wrapper);
        return new PageResult<>(result.getTotal(), result.getRecords().stream().map(this::toVO).toList());
    }

    public PracticeVO detail(long id, String password) {
        Practice practice = requirePublished(id);

        // 检查软删除（只有超级管理员和创建者能看到已删除的练习）
        if (Boolean.TRUE.equals(practice.isDeleted)) {
            AuthUser user = CurrentUser.get();
            if (user == null || (!"SUPER_ADMIN".equals(user.role()) && !practice.ownerId.equals(user.id()))) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(ErrorCode.NOT_FOUND, "练习不存在");
            }
        }

        ensureVisible(practice);

        if (practice.passwordHash != null && !practice.passwordHash.isBlank()) {
            if (password == null || password.isBlank()) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(401, "需要练习密码");
            }

            // 添加频率限制（需要 Redis）
            String rateKey = "practice:pwd:attempt:" + id + ":user:" +
                (CurrentUser.get() != null ? CurrentUser.get().id() : "anonymous");
            Long attempts = redisTemplate.opsForValue().increment(rateKey);
            if (attempts == 1) {
                redisTemplate.expire(rateKey, java.time.Duration.ofMinutes(5));
            }
            if (attempts > 5) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(429, "密码尝试次数过多，请5分钟后再试");
            }

            if (!passwordEncoder.matches(password, practice.passwordHash)) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(401, "练习密码错误");
            }

            // 验证成功，清除计数
            redisTemplate.delete(rateKey);
        }

        /**
         * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toVO(practice);
    }

    @Transactional
    public PracticeVO create(PracticeCreateRequest request) {
        AuthUser user = CurrentUser.required();
        AudienceType audience = request.audience() == null ? AudienceType.ALL : request.audience();
        if (audience != AudienceType.ALL && audience != AudienceType.CLASS) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "题单开放范围仅支持所有人或班级");
        }
        if (audience != AudienceType.ALL && request.audienceId() == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "受众 ID 不能为空");
        }
        ensureCanUseAudience(user, audience, request.audienceId());
        if (request.problemIds() == null || request.problemIds().isEmpty()) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "练习题目不能为空");
        }
        List<Problem> problems = problemMapper.selectBatchIds(request.problemIds());
        if (problems.size() != request.problemIds().stream().distinct().count()) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(404, "练习题目不存在");
        }

        Practice practice = new Practice();
        practice.title = request.title();
        practice.description = request.description();
        practice.ownerId = user.id();
        practice.audience = audience.name();
        practice.audienceId = audience == AudienceType.ALL ? null : request.audienceId();
        practice.passwordHash = request.password() == null || request.password().isBlank()
            ? null
            : passwordEncoder.encode(request.password());
        practice.published = true;
        practiceMapper.insert(practice);

        int order = 1;
        for (Long problemId : request.problemIds()) {
            PracticeProblem practiceProblem = new PracticeProblem();
            practiceProblem.practiceId = practice.id;
            practiceProblem.problemId = problemId;
            practiceProblem.displayOrder = order++;
            practiceProblem.score = 100;
            practiceProblemMapper.insert(practiceProblem);
        }
        /**
         * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toVO(practice);
    }

    @Transactional
    public PracticeVO update(long id, PracticeCreateRequest request) {
        Practice practice = requireOwner(id);

        AudienceType audience = request.audience() == null ? AudienceType.ALL : request.audience();
        if (audience != AudienceType.ALL && audience != AudienceType.CLASS) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "题单开放范围仅支持所有人或班级");
        }
        if (audience != AudienceType.ALL && request.audienceId() == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "受众 ID 不能为空");
        }

        AuthUser user = CurrentUser.required();
        ensureCanUseAudience(user, audience, request.audienceId());

        practice.title = request.title();
        practice.description = request.description();
        practice.audience = audience.name();
        practice.audienceId = audience == AudienceType.ALL ? null : request.audienceId();

        if (request.password() != null && !request.password().isBlank()) {
            practice.passwordHash = passwordEncoder.encode(request.password());
        }

        if (request.problemIds() != null && !request.problemIds().isEmpty()) {
            List<Problem> problems = problemMapper.selectBatchIds(request.problemIds());
            if (problems.size() != request.problemIds().stream().distinct().count()) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(404, "练习题目不存在");
            }
            practiceProblemMapper.delete(new QueryWrapper<PracticeProblem>()
                .eq("practice_id", id));
            int order = 1;
            for (Long problemId : request.problemIds()) {
                PracticeProblem pp = new PracticeProblem();
                pp.practiceId = id;
                pp.problemId = problemId;
                pp.displayOrder = order++;
                pp.score = 100;
                practiceProblemMapper.insert(pp);
            }
        }

        practiceMapper.updateById(practice);
        /**
         * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toVO(practice);
    }

    public PracticeReportVO report(long id) {
        Practice practice = requireOwner(id);
        List<PracticeProblem> practiceProblems = practiceProblems(practice.id);
        Map<Long, PracticeProblem> scoreByProblem = practiceProblems
            .stream()
            .collect(Collectors.toMap(item -> item.problemId, Function.identity()));
        List<Long> problemIds = practiceProblems.stream().map(item -> item.problemId).toList();
        Map<Long, Problem> problems = problemIds.isEmpty()
            ? Map.of()
            : problemMapper.selectBatchIds(problemIds)
                .stream()
                .collect(Collectors.toMap(item -> item.id, Function.identity()));

        List<Submission> submissions = submissionMapper.selectList(
            new QueryWrapper<Submission>().eq("practice_id", practice.id).orderByDesc("created_at")
        );
        Map<Long, User> users = submissions.isEmpty()
            ? Map.of()
            : userMapper.selectBatchIds(submissions.stream().map(item -> item.userId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(item -> item.id, Function.identity()));

        Map<Long, RankAccumulator> ranks = new LinkedHashMap<>();
        for (Submission submission : submissions) {
            RankAccumulator rank = ranks.computeIfAbsent(submission.userId, userId -> new RankAccumulator());
            rank.submissionCount += 1;
            if (SubmissionStatus.AC.name().equals(submission.status)) {
                PracticeProblem practiceProblem = scoreByProblem.get(submission.problemId);
                if (practiceProblem != null && rank.acceptedProblems.putIfAbsent(submission.problemId, practiceProblem.score) == null) {
                    rank.score += practiceProblem.score;
                    rank.solved += 1;
                }
            }
        }

        List<PracticeRankVO> rankings = new ArrayList<>();
        for (Map.Entry<Long, RankAccumulator> entry : ranks.entrySet()) {
            User user = users.get(entry.getKey());
            RankAccumulator rank = entry.getValue();
            rankings.add(new PracticeRankVO(
                entry.getKey(),
                user == null ? String.valueOf(entry.getKey()) : user.displayName,
                rank.score,
                rank.solved,
                rank.submissionCount
            ));
        }
        rankings.sort(
            Comparator.comparing(PracticeRankVO::score).reversed()
                .thenComparing(PracticeRankVO::submissionCount)
                .thenComparing(PracticeRankVO::userId)
        );

        List<PracticeSubmissionVO> submissionVOs = submissions
            .stream()
            .map(submission -> {
                User user = users.get(submission.userId);
                Problem problem = problems.get(submission.problemId);
                /**
                 * 封装练习提交VO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
                 */
                return new PracticeSubmissionVO(
                    submission.id,
                    submission.userId,
                    user == null ? String.valueOf(submission.userId) : user.displayName,
                    submission.problemId,
                    problem == null ? String.valueOf(submission.problemId) : problem.title,
                    submission.language,
                    submission.status,
                    submission.timeUsed,
                    submission.memoryUsed,
                    submission.createdAt
                );
            })
            .toList();

        /**
         * 封装练习ReportVO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new PracticeReportVO(practice.id, rankings.size(), submissions.size(), rankings, submissionVOs);
    }

    @Transactional
    public void delete(long id) {
        Practice practice = requireOwner(id);

        // 软删除
        practice.isDeleted = true;
        practice.deletedAt = LocalDateTime.now();
        practiceMapper.updateById(practice);
    }

    private Practice requirePublished(long id) {
        Practice practice = practiceMapper.selectById(id);
        if (practice == null || !Boolean.TRUE.equals(practice.published)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(404, "练习不存在");
        }
        return practice;
    }

    private Practice requireOwner(long id) {
        Practice practice = practiceMapper.selectById(id);
        if (practice == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "练习不存在");
        }
        AuthUser user = CurrentUser.required();
        if (!practiceAccessPolicy.can(user, com.qoj.security.policy.Permission.UPDATE, practice)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无访问权限");
        }
        return practice;
    }

    private void ensureVisible(Practice practice) {
        // 使用Policy检查基本查看权限
        AuthUser user = CurrentUser.get();

        if (!practiceAccessPolicy.can(user, com.qoj.security.policy.Permission.VIEW, practice)) {
            // Policy拒绝后，检查是否是audience限制的问题
            if (!AudienceType.ALL.name().equals(practice.audience)) {
                // 必须登录才能检查班级成员
                if (user == null) {
                    /**
                     * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                     */
                    throw new BizException(ErrorCode.UNAUTHORIZED.getCode(), "请先登录");
                }

                if (AudienceType.CLASS.name().equals(practice.audience) && practice.audienceId != null) {
                    Long memberCount = classMemberMapper.selectCount(
                        new QueryWrapper<ClassMember>()
                            .eq("class_id", practice.audienceId)
                            .eq("user_id", user.id())
                    );
                    if (memberCount != null && memberCount > 0) {
                        return;
                    }
                    /**
                     * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                     */
                    throw new BizException(ErrorCode.FORBIDDEN.getCode(), "该题单仅限指定班级成员");
                }
            }
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无权访问该练习");
        }
    }

    private void ensureCanUseAudience(AuthUser user, AudienceType audience, Long audienceId) {
        if (audience == AudienceType.ALL) {
            return;
        }
        if ("SUPER_ADMIN".equals(user.role())) {
            return;
        }
        if (audience == AudienceType.CLASS) {
            ClassRoom classRoom = classRoomMapper.selectById(audienceId);
            if (classRoom == null) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(ErrorCode.NOT_FOUND.getCode(), "班级不存在");
            }
            if (!"TEACHER".equals(user.role()) || !user.id().equals(classRoom.teacherId)) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(ErrorCode.FORBIDDEN.getCode(), "只能选择自己管理的班级");
            }
            return;
        }
    }

    private PracticeVO toVO(Practice practice) {
        /**
         * 封装练习VO相关逻辑。执行持久化写入。
         */
        return new PracticeVO(
            practice.id,
            practice.title,
            practice.description,
            practice.audience,
            practice.audienceId,
            practice.passwordHash != null && !practice.passwordHash.isBlank(),
            practice.ownerId,
            practiceProblems(practice.id).stream().map(item -> problemService.detailAsVOUnchecked(item.problemId)).toList(),
            practice.createdAt,
            practice.updatedAt
        );
    }

    private List<PracticeProblem> practiceProblems(Long practiceId) {
        return practiceProblemMapper.selectList(
            new QueryWrapper<PracticeProblem>().eq("practice_id", practiceId).orderByAsc("display_order")
        );
    }

    /**
     * 排名Accumulator领域类型。封装 practice.service 模块内的相关职责。
     */
    private static class RankAccumulator {
        int score;
        int solved;
        int submissionCount;
        Map<Long, Integer> acceptedProblems = new HashMap<>();
    }
}

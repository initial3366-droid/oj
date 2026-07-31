package com.qoj.module.practice.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.qoj.common.ErrorCode;
import com.qoj.common.PageResult;
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
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.teacher.entity.Major;
import com.qoj.module.teacher.mapper.MajorMapper;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import com.qoj.security.policy.ResourceAccessService;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
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
    private final com.qoj.security.policy.PracticeAccessPolicy practiceAccessPolicy;
    private final ResourceAccessService resourceAccessService;
    private final MajorMapper majorMapper;

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
        com.qoj.security.policy.PracticeAccessPolicy practiceAccessPolicy,
        ResourceAccessService resourceAccessService,
        MajorMapper majorMapper
    ) {
        this.practiceMapper = practiceMapper;
        this.practiceProblemMapper = practiceProblemMapper;
        this.problemMapper = problemMapper;
        this.problemService = problemService;
        this.submissionMapper = submissionMapper;
        this.userMapper = userMapper;
        this.practiceAccessPolicy = practiceAccessPolicy;
        this.resourceAccessService = resourceAccessService;
        this.majorMapper = majorMapper;
    }

    public PageResult<PracticeVO> adminList(int page, int pageSize) {
        AuthUser user = CurrentUser.required();
        List<Practice> visible = practiceMapper.selectList(
            new QueryWrapper<Practice>().eq("is_deleted", false).orderByDesc("created_at")
        ).stream().filter(item -> resourceAccessService.canAccessPractice(user, item)).toList();
        int normalizedPage = Math.max(1, page);
        int normalizedSize = Math.min(Math.max(1, pageSize), 200);
        int from = Math.min((normalizedPage - 1) * normalizedSize, visible.size());
        int to = Math.min(from + normalizedSize, visible.size());
        return new PageResult<>(visible.size(), visible.subList(from, to).stream().map(this::toVO).toList());
    }

    @Transactional
    public PracticeVO create(PracticeCreateRequest request) {
        AuthUser user = CurrentUser.required();
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
        if (problems.stream().anyMatch(problem -> !resourceAccessService.canUseProblem(user, problem))) {
            throw new BizException(403, "题单包含无权使用的题目");
        }

        Practice practice = new Practice();
        practice.title = request.title();
        practice.description = request.description();
        practice.ownerId = user.id();
        practice.ownerAccountType = user.accountType();
        var scope = resourceAccessService.resolveScope(user, request.accessScope(), request.majorId());
        practice.accessScope = scope.accessScope();
        practice.majorId = scope.majorId();
        practice.audience = "ALL";
        practice.audienceId = null;
        practice.passwordHash = null;
        practice.published = false;
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
        AuthUser user = CurrentUser.required();

        practice.title = request.title();
        practice.description = request.description();
        var scope = resourceAccessService.resolveScope(user, request.accessScope(), request.majorId());
        practice.accessScope = scope.accessScope();
        practice.majorId = scope.majorId();

        if (request.problemIds() != null && !request.problemIds().isEmpty()) {
            List<Long> existingProblemIds = practiceProblems(id).stream()
                .map(item -> item.problemId)
                .toList();
            List<Problem> problems = problemMapper.selectBatchIds(request.problemIds());
            if (problems.size() != request.problemIds().stream().distinct().count()) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(404, "练习题目不存在");
            }
            if (problems.stream().anyMatch(problem ->
                !existingProblemIds.contains(problem.id) && !resourceAccessService.canUseProblem(user, problem)
            )) {
                throw new BizException(403, "题单包含无权使用的题目");
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

    @Transactional
    public PracticeVO copy(long id) {
        AuthUser user = CurrentUser.required();
        Practice source = practiceMapper.selectById(id);
        if (source == null || Boolean.TRUE.equals(source.isDeleted)
            || !resourceAccessService.canAccessPractice(user, source)) {
            throw new BizException(404, "题单不存在");
        }
        Practice copy = new Practice();
        copy.title = source.title + "（副本）";
        copy.description = source.description;
        copy.ownerId = user.id();
        copy.ownerAccountType = user.accountType();
        copy.accessScope = "PRIVATE";
        copy.majorId = user.teacherAccount() ? user.teacher().majorId : source.majorId;
        copy.audience = "ALL";
        copy.published = false;
        practiceMapper.insert(copy);
        for (PracticeProblem sourceProblem : practiceProblems(source.id)) {
            PracticeProblem item = new PracticeProblem();
            item.practiceId = copy.id;
            item.problemId = sourceProblem.problemId;
            item.displayOrder = sourceProblem.displayOrder;
            item.score = sourceProblem.score;
            practiceProblemMapper.insert(item);
        }
        return toVO(copy);
    }

    public PracticeReportVO report(long id) {
        Practice practice = requireOwner(id);
        AuthUser reporter = CurrentUser.required();
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

        QueryWrapper<Submission> submissionQuery = new QueryWrapper<Submission>()
            .eq("practice_id", practice.id);
        if (!resourceAccessService.isSuperAdmin(reporter)) {
            submissionQuery.apply(
                "practice_publication_id IN (SELECT id FROM practice_publications WHERE publisher_account_type = {0} AND publisher_id = {1})",
                reporter.accountType(),
                reporter.id()
            );
        }
        List<Submission> submissions = submissionMapper.selectList(submissionQuery.orderByDesc("created_at"));
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

    private PracticeVO toVO(Practice practice) {
        AuthUser user = CurrentUser.get();
        boolean owner = user != null && resourceAccessService.isOwner(user, practice.ownerAccountType, practice.ownerId);
        boolean contentAccount = user != null && (user.adminAccount() || user.teacherAccount());
        Major major = practice.majorId == null ? null : majorMapper.selectById(practice.majorId);
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
            practice.updatedAt,
            practice.ownerAccountType,
            practice.accessScope,
            practice.majorId,
            major == null ? null : major.name,
            owner,
            owner || resourceAccessService.isSuperAdmin(user),
            contentAccount,
            contentAccount
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

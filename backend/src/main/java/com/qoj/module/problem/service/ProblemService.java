package com.qoj.module.problem.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.ErrorCode;
import com.qoj.common.PageResult;
import com.qoj.common.enums.SubmissionStatus;
import com.qoj.common.exception.BizException;
import com.qoj.common.redis.RedisKeys;
import com.qoj.module.problem.dto.CommunicationConfig;
import com.qoj.module.problem.dto.ProblemSampleCaseRequest;
import com.qoj.module.problem.dto.ProblemTestCaseRequest;
import com.qoj.module.problem.dto.ProblemUpdateRequest;
import com.qoj.module.problem.dto.TestCaseImportProgress;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.entity.ProblemFolder;
import com.qoj.module.problem.entity.ProblemTestCase;
import com.qoj.module.problem.mapper.ProblemFolderMapper;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.mapper.ProblemTestCaseMapper;
import com.qoj.module.problem.vo.AdminProblemVO;
import com.qoj.module.problem.vo.ProblemSampleCaseVO;
import com.qoj.module.problem.vo.ProblemTestCaseVO;
import com.qoj.module.problem.vo.ProblemVO;
import com.qoj.module.problem.vo.PublicProblemVO;
import com.qoj.module.submission.entity.Submission;
import com.qoj.module.submission.entity.UserProblemStatus;
import com.qoj.module.submission.mapper.SubmissionMapper;
import com.qoj.module.submission.mapper.UserProblemStatusMapper;
import com.qoj.module.teacher.entity.Major;
import com.qoj.module.teacher.entity.Teacher;
import com.qoj.module.teacher.mapper.MajorMapper;
import com.qoj.module.teacher.mapper.TeacherMapper;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.AdminUserMapper;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import com.qoj.security.policy.Permission;
import com.qoj.security.policy.ProblemAccessPolicy;
import com.qoj.security.policy.ResourceAccessService;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * 题目业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class ProblemService {
    private final ProblemMapper problemMapper;
    private final ProblemTestCaseMapper problemTestCaseMapper;
    private final SubmissionMapper submissionMapper;
    private final UserProblemStatusMapper userProblemStatusMapper;
    private final UserMapper userMapper;
    private final AdminUserMapper adminUserMapper;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;
    private final ProblemAccessPolicy problemAccessPolicy;
    private final ProblemFolderMapper problemFolderMapper;
    private final TeacherMapper teacherMapper;
    private final MajorMapper majorMapper;
    private final ResourceAccessService resourceAccessService;
    private final ProblemFolderService problemFolderService;

    /**
     * 构造 题目Service 实例并保存其必要依赖或初始状态。调用前会结合当前登录身份执行权限判断；从持久化层读取数据；读写 Redis 中的缓存、锁或限流状态。
     */
    public ProblemService(
        ProblemMapper problemMapper,
        ProblemTestCaseMapper problemTestCaseMapper,
        SubmissionMapper submissionMapper,
        UserProblemStatusMapper userProblemStatusMapper,
        UserMapper userMapper,
        AdminUserMapper adminUserMapper,
        ObjectMapper objectMapper,
        StringRedisTemplate redisTemplate,
        ProblemAccessPolicy problemAccessPolicy,
        ProblemFolderMapper problemFolderMapper,
        TeacherMapper teacherMapper,
        MajorMapper majorMapper,
        ResourceAccessService resourceAccessService,
        ProblemFolderService problemFolderService
    ) {
        this.problemMapper = problemMapper;
        this.problemTestCaseMapper = problemTestCaseMapper;
        this.submissionMapper = submissionMapper;
        this.userProblemStatusMapper = userProblemStatusMapper;
        this.userMapper = userMapper;
        this.adminUserMapper = adminUserMapper;
        this.objectMapper = objectMapper;
        this.redisTemplate = redisTemplate;
        this.problemAccessPolicy = problemAccessPolicy;
        this.problemFolderMapper = problemFolderMapper;
        this.teacherMapper = teacherMapper;
        this.majorMapper = majorMapper;
        this.resourceAccessService = resourceAccessService;
        this.problemFolderService = problemFolderService;
    }

    public PageResult<PublicProblemVO> list(int page, int pageSize, String keyword, Integer difficulty, String tag) {
        QueryWrapper<Problem> wrapper = new QueryWrapper<>();
        wrapper.eq("is_deleted", false);
        wrapper.eq("student_publish_status", "PUBLISHED");
        if (keyword != null && !keyword.isBlank()) {
            wrapper.and(w -> w.like("title", keyword).or().like("statement", keyword));
        }
        if (difficulty != null) {
            wrapper.eq("difficulty", difficulty);
        }
        if (tag != null && !tag.isBlank()) {
            wrapper.like("tags", tag);
        }
        wrapper.orderByDesc("created_at");
        Page<Problem> result = problemMapper.selectPage(Page.of(page, pageSize), wrapper);
        List<PublicProblemVO> problems = result.getRecords().stream().map(this::toPublicVO).toList();
        return new PageResult<>(result.getTotal(), withPublicAttemptStatuses(problems, currentUserId()));
    }

    public PageResult<AdminProblemVO> adminList(int page, int pageSize, String keyword,
            Integer difficulty, String tag, Long folderId, String ownerName) {
        AuthUser user = CurrentUser.required();
        QueryWrapper<Problem> wrapper = new QueryWrapper<>();
        wrapper.eq("is_deleted", false);
        if (folderId != null) {
            ProblemFolder folder = problemFolderMapper.selectById(folderId);
            if (!resourceAccessService.canAccessFolder(user, folder)) {
                throw new BizException(404, "题目文件夹不存在或无权访问");
            }
        }
        if (!"SUPER_ADMIN".equals(user.role())) {
            Teacher teacher = user.teacherAccount() ? teacherMapper.selectById(user.id()) : null;
            wrapper.and(visible -> {
                visible.and(owner -> owner.eq("owner_id", user.id()).eq("owner_account_type", user.accountType()))
                    .or().eq("access_scope", "ALL");
                if (teacher != null && teacher.majorId != null) {
                        visible.or(major -> major.eq("access_scope", "MAJOR").eq("major_id", teacher.majorId))
                        .or().apply(
                            "id IN (SELECT pfi.problem_id FROM problem_folder_items pfi JOIN problem_folders pf ON pf.id = pfi.folder_id WHERE pfi.relation_type = 'GRANT' AND (pf.access_scope = 'ALL' OR (pf.access_scope = 'MAJOR' AND pf.major_id = {0}) OR (pf.owner_account_type = 'TEACHER' AND pf.owner_id = {1})))",
                            teacher.majorId,
                            teacher.id
                        );
                } else {
                    visible.or().apply(
                        "id IN (SELECT pfi.problem_id FROM problem_folder_items pfi JOIN problem_folders pf ON pf.id = pfi.folder_id WHERE pfi.relation_type = 'GRANT' AND pf.access_scope = 'ALL')"
                    );
                }
            });
        }
        if (keyword != null && !keyword.isBlank()) {
            String search = keyword.trim();
            wrapper.and(w -> {
                w.like("title", search).or().like("tags", search).or().like("statement", search);
                if (search.matches("[0-9]{1,18}")) {
                    w.or().eq("id", Long.parseLong(search));
                }
            });
        }
        if (difficulty != null) {
            wrapper.eq("difficulty", difficulty);
        }
        if (tag != null && !tag.isBlank()) {
            wrapper.like("tags", tag);
        }
        if (folderId != null) {
            wrapper.apply(
                "id IN (SELECT problem_id FROM problem_folder_items WHERE folder_id = {0})",
                folderId
            );
        }
        if (ownerName != null && !ownerName.isBlank()) {
            String normalizedOwnerName = ownerName.trim();
            wrapper.and(w -> w
                .apply("(owner_account_type = 'USER' AND owner_id IN (SELECT id FROM users WHERE display_name LIKE CONCAT('%', {0}, '%')))", normalizedOwnerName)
                .or()
                .apply("(owner_account_type = 'TEACHER' AND owner_id IN (SELECT id FROM teachers WHERE display_name LIKE CONCAT('%', {0}, '%')))", normalizedOwnerName)
                .or()
                .apply("(owner_account_type = 'ADMIN' AND owner_id IN (SELECT id FROM admin_users WHERE display_name LIKE CONCAT('%', {0}, '%')))", normalizedOwnerName)
            );
        }
        wrapper.orderByDesc("created_at");
        Page<Problem> result = problemMapper.selectPage(Page.of(page, pageSize), wrapper);
        return new PageResult<>(result.getTotal(), result.getRecords().stream().map(this::toAdminVO).toList());
    }

    public Object detail(long id) {
        Problem problem = problemMapper.selectById(id);
        if (problem == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "题目不存在");
        }

        // 检查软删除状态
        AuthUser user = CurrentUser.get();
        if (Boolean.TRUE.equals(problem.isDeleted)) {
            // 只有SUPER_ADMIN和创建者可以查看已删除的题目
            if (user == null || (!"SUPER_ADMIN".equals(user.role()) && !isOwner(problem, user))) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(ErrorCode.NOT_FOUND.getCode(), "题目不存在");
            }
        }

        // 使用Policy检查查看权限
        if (!problemAccessPolicy.can(user, Permission.VIEW, problem)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "题目不存在");
        }

        // 教师账号或拥有管理权限时返回 AdminProblemVO（含全量统计），否则返回 PublicProblemVO
        boolean isAdmin = user != null && (user.teacherAccount()
            || problemAccessPolicy.can(user, Permission.UPDATE, problem));

        if (isAdmin) {
            /**
             * 封装with管理员Attempt状态相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return withAdminAttemptStatus(toAdminVO(problem), attemptStatus(currentUserId(), problem.id));
        } else {
            /**
             * 封装withPublicAttempt状态相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return withPublicAttemptStatus(toPublicVO(problem), attemptStatus(currentUserId(), problem.id));
        }
    }

    public PublicProblemVO publicDetail(long id) {
        Problem problem = problemMapper.selectById(id);
        if (problem == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "题目不存在");
        }

        // 检查软删除状态
        if (Boolean.TRUE.equals(problem.isDeleted)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "题目不存在");
        }

        // 只返回公开题目或用户有权限的题目
        AuthUser user = CurrentUser.get();
        if (!problemAccessPolicy.can(user, Permission.VIEW, problem)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "题目不存在");
        }

        /**
         * 封装withPublicAttempt状态相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return withPublicAttemptStatus(toPublicVO(problem), attemptStatus(currentUserId(), problem.id));
    }

    /**
     * 获取题目详情，返回ProblemVO（包含所有字段）
     * 用于内部模块调用（如Practice、Contest、Home等）
     */
    public ProblemVO detailAsVO(long id) {
        Problem problem = problemMapper.selectById(id);
        if (problem == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "题目不存在");
        }

        // 检查软删除状态
        AuthUser user = CurrentUser.get();
        if (Boolean.TRUE.equals(problem.isDeleted)) {
            // 只有SUPER_ADMIN和创建者可以查看已删除的题目
            if (user == null || (!"SUPER_ADMIN".equals(user.role()) && !isOwner(problem, user))) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(ErrorCode.NOT_FOUND.getCode(), "题目不存在");
            }
        }

        // 使用Policy检查查看权限
        if (!problemAccessPolicy.can(user, Permission.VIEW, problem)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "题目不存在");
        }

        /**
         * 封装withAttempt状态相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return withAttemptStatus(toVO(problem), attemptStatus(currentUserId(), problem.id));
    }

    public ProblemVO detailAsVOUnchecked(long id) {
        Problem problem = problemMapper.selectById(id);
        if (problem == null || Boolean.TRUE.equals(problem.isDeleted)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "题目不存在");
        }
        /**
         * 封装withAttempt状态相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return withAttemptStatus(toVO(problem), attemptStatus(currentUserId(), problem.id));
    }

    @Transactional
    public AdminProblemVO update(long id, ProblemUpdateRequest request) {
        Problem problem = requireOwnerOrSuperAdmin(id);
        List<ProblemSampleCaseRequest> samples = resolveSamples(request);
        problem.title = request.title();
        problem.statement = request.statement();
        problem.inputFormat = request.inputFormat();
        problem.outputFormat = request.outputFormat();
        boolean clearCommunication = request.communication() != null && !Boolean.TRUE.equals(request.communication().enabled());
        if (request.communication() != null) {
            problem.communicationConfig = CommunicationConfig.encode(request.communication());
            if (clearCommunication) {
                String finalChecker = request.checkerSource() == null ? problem.checkerSource : request.checkerSource();
                ensureHiddenTestCasesHaveExpectedOutput(problem, finalChecker);
            }
        }
        boolean clearCheckerSource = false;
        if (request.checkerSource() != null) {
            String checkerSource = normalizeCheckerSource(request.checkerSource());
            if (problem.communicationConfig == null) ensureHiddenTestCasesHaveExpectedOutput(problem, checkerSource);
            problem.checkerSource = checkerSource;
            clearCheckerSource = checkerSource == null;
        }
        problem.sampleCases = writeSampleCases(samples);
        problem.timeLimit = request.timeLimit();
        problem.memoryLimit = request.memoryLimit();
        problem.difficulty = request.difficulty() == null
            ? (problem.difficulty == null ? 1 : problem.difficulty)
            : request.difficulty();
        problem.tags = writeTags(request.tags());
        if (request.folderId() != null) {
            problem.folderId = request.folderId();
        }
        AuthUser user = CurrentUser.required();
        var scope = resourceAccessService.resolveScope(user, request.accessScope(), request.majorId());
        problem.accessScope = scope.accessScope();
        problem.majorId = scope.majorId();
        String publishStatus = normalizePublishStatus(request.studentPublishStatus(), request.isPublic());
        problem.studentPublishStatus = publishStatus;
        problem.isPublic = "PUBLISHED".equals(publishStatus);
        if (problem.isPublic) {
            problem.publishedByAccountType = user.accountType();
            problem.publishedById = user.id();
            problem.publishedAt = LocalDateTime.now();
        } else {
            problem.publishedByAccountType = null;
            problem.publishedById = null;
            problem.publishedAt = null;
        }
        problem.updatedAt = LocalDateTime.now();
        problemMapper.updateById(problem);
        if (clearCommunication) {
            problemMapper.update(null, new UpdateWrapper<Problem>().eq("id", id).set("communication_config", null));
        }
        // MyBatis-Plus skips null fields by default; explicitly persist a cleared checker.
        if (clearCheckerSource) {
            problemMapper.update(
                null,
                new UpdateWrapper<Problem>()
                    .eq("id", id)
                    .set("checker_source", null)
            );
        }
        if (request.folderId() != null) {
            problemFolderService.assignOwnedProblem(request.folderId(), problem);
        }
        replaceTestCases(problem.id, sampleEntities(samples), true);
        redisTemplate.delete(RedisKeys.problem(problem.id));
        Problem updated = problemMapper.selectById(problem.id);
        /**
         * 构造或转换管理员VOForUpdate。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toAdminVOForUpdate(updated == null ? problem : updated);
    }

    @Transactional
    public void delete(long id) {
        Problem problem = requireOwnerOrSuperAdmin(id);
        // 软删除
        problem.isDeleted = true;
        problem.deletedAt = LocalDateTime.now();
        problemMapper.updateById(problem);
        redisTemplate.delete(RedisKeys.problem(problem.id));
    }

    @Transactional
    public int batchPublish(List<Long> ids) {
        List<Problem> problems = requireBatchManageable(ids, Permission.UPDATE);
        List<Long> unpublishedIds = problems.stream()
            .filter(problem -> !"PUBLISHED".equals(problem.studentPublishStatus))
            .map(problem -> problem.id).toList();
        if (unpublishedIds.isEmpty()) return 0;
        AuthUser user = CurrentUser.required();
        var now = LocalDateTime.now();
        int count = problemMapper.update(null, new UpdateWrapper<Problem>()
            .in("id", unpublishedIds)
            .set("student_publish_status", "PUBLISHED")
            .set("is_public", true)
            .set("published_by_account_type", user.accountType())
            .set("published_by_id", user.id())
            .set("published_at", now)
            .set("updated_at", now));
        redisTemplate.delete(unpublishedIds.stream().map(RedisKeys::problem).toList());
        return count;
    }

    @Transactional
    public int batchDelete(List<Long> ids) {
        List<Problem> problems = requireBatchManageable(ids, Permission.DELETE);
        List<Long> problemIds = problems.stream().map(problem -> problem.id).toList();
        var now = LocalDateTime.now();
        int count = problemMapper.update(null, new UpdateWrapper<Problem>()
            .in("id", problemIds)
            .set("is_deleted", true)
            .set("deleted_at", now)
            .set("updated_at", now));
        redisTemplate.delete(problemIds.stream().map(RedisKeys::problem).toList());
        return count;
    }

    @Transactional
    public int batchUnpublish(List<Long> ids) {
        List<Problem> problems = requireBatchManageable(ids, Permission.UPDATE);
        List<Long> publishedIds = problems.stream()
            .filter(problem -> "PUBLISHED".equals(problem.studentPublishStatus))
            .map(problem -> problem.id).toList();
        if (publishedIds.isEmpty()) return 0;
        int count = problemMapper.update(null, new UpdateWrapper<Problem>()
            .in("id", publishedIds)
            .set("student_publish_status", "DRAFT")
            .set("is_public", false)
            .set("published_by_account_type", null)
            .set("published_by_id", null)
            .set("published_at", null)
            .set("updated_at", LocalDateTime.now()));
        redisTemplate.delete(publishedIds.stream().map(RedisKeys::problem).toList());
        return count;
    }

    private List<Problem> requireBatchManageable(List<Long> ids, Permission permission) {
        List<Long> distinctIds = ids.stream().distinct().sorted().toList();
        // Lock and validate the full selection before changing any item.
        List<Problem> problems = problemMapper.selectList(new QueryWrapper<Problem>()
            .in("id", distinctIds).orderByAsc("id").last("FOR UPDATE"));
        if (problems.size() != distinctIds.size() || problems.stream().anyMatch(problem -> Boolean.TRUE.equals(problem.isDeleted))) {
            throw new BizException(ErrorCode.NOT_FOUND, "所选题目中有题目不存在或已删除，请刷新列表后重试");
        }
        AuthUser user = CurrentUser.required();
        for (Problem problem : problems) {
            if (!problemAccessPolicy.can(user, permission, problem)) {
                throw new BizException(ErrorCode.FORBIDDEN, "无权操作题目 #" + problem.id + "，本次批量操作未执行");
            }
        }
        return problems;
    }

    public void replaceTestCases(Long problemId, List<ProblemTestCase> testCases, boolean sample) {
        replaceTestCases(problemId, testCases, sample, progress -> {});
    }

    private void replaceTestCases(Long problemId, List<ProblemTestCase> testCases, boolean sample,
                                  Consumer<TestCaseImportProgress> progress) {
        Problem problem = sample ? null : problemMapper.selectById(problemId);
        String checkerSource = effectiveChecker(problem);
        List<ProblemTestCase> normalized = normalizeReplacementTestCases(problemId, testCases, sample, checkerSource);
        problemTestCaseMapper.delete(
            new QueryWrapper<ProblemTestCase>().eq("problem_id", problemId).eq("sample", sample)
        );
        int saved = 0;
        for (ProblemTestCase testCase : normalized) {
            problemTestCaseMapper.insert(testCase);
            progress.accept(new TestCaseImportProgress("saved", ++saved, normalized.size(), testCase.caseNo));
        }
        redisTemplate.delete(RedisKeys.problem(problemId));
    }

    public String checkerSource(long problemId) {
        Problem problem = requireOwnerOrSuperAdmin(problemId);
        return problem.checkerSource == null ? "" : problem.checkerSource;
    }

    public CommunicationConfig communicationConfig(long problemId) {
        return CommunicationConfig.decode(requireOwnerOrSuperAdmin(problemId).communicationConfig);
    }

    private String effectiveChecker(Problem problem) {
        return problem != null && problem.communicationConfig != null ? "communication" : problem == null ? null : problem.checkerSource;
    }

    String normalizeCheckerSource(String source) {
        if (source == null || source.isBlank()) {
            return null;
        }
        return source.replace("\r\n", "\n").replace('\r', '\n');
    }

    private static boolean isSpecialJudge(String checkerSource) {
        return checkerSource != null && !checkerSource.isBlank();
    }

    static boolean requiresExpectedOutput(boolean sample, String checkerSource) {
        return sample || !isSpecialJudge(checkerSource);
    }

    private static void validateExpectedOutput(boolean sample, String checkerSource, String output, int caseNo) {
        if (requiresExpectedOutput(sample, checkerSource) && output == null) {
            throw new BizException(400, (sample ? "样例" : "测试点") + " " + caseNo + " 的输出字段不能缺失");
        }
    }

    private List<ProblemTestCase> normalizeReplacementTestCases(
        Long problemId,
        List<ProblemTestCase> testCases,
        boolean sample,
        String checkerSource
    ) {
        List<ProblemTestCase> normalized = new ArrayList<>();
        Set<Integer> usedCaseNos = new HashSet<>();
        int nextCaseNo = 1;
        for (ProblemTestCase item : testCases == null ? List.<ProblemTestCase>of() : testCases) {
            if (item == null) {
                continue;
            }
            int caseNo = item.caseNo == null ? nextCaseNo : item.caseNo;
            while (usedCaseNos.contains(caseNo)) {
                if (item.caseNo != null) {
                    /**
                     * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                     */
                    throw new BizException(400, "测试点编号 " + item.caseNo + " 重复");
                }
                caseNo++;
            }
            if (caseNo <= 0) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(400, "测试点编号必须大于 0");
            }
            if (sample && item.inputData == null) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(400, "样例 " + caseNo + " 的输入字段不能缺失");
            }
            validateExpectedOutput(sample, checkerSource, item.outputData, caseNo);
            usedCaseNos.add(caseNo);
            nextCaseNo = Math.max(nextCaseNo, caseNo + 1);

            ProblemTestCase testCase = new ProblemTestCase();
            testCase.id = null;
            testCase.problemId = problemId;
            testCase.sample = sample;
            testCase.caseNo = caseNo;
            testCase.inputData = item.inputData == null ? "" : item.inputData;
            testCase.outputData = item.outputData == null ? "" : item.outputData;
            testCase.publicInput = sample ? null : item.publicInput;
            testCase.explanation = item.explanation;
            normalized.add(testCase);
        }
        return normalized;
    }

    public List<ProblemTestCaseVO> testCases(long problemId) {
        Problem problem = problemMapper.selectById(problemId);
        if (problem == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(404, "题目不存在");
        }
        AuthUser user = CurrentUser.required();
        if (!problemAccessPolicy.can(user, Permission.VIEW_HIDDEN_CASE, problem)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN, "无权查看该题目测试点");
        }
        return problemTestCaseMapper
            .selectList(
                new QueryWrapper<ProblemTestCase>()
                    .eq("problem_id", problemId)
                    .eq("sample", false)
                    .orderByAsc("case_no")
            )
            .stream()
            .map(this::toTestCaseVO)
            .toList();
    }

    @Transactional
    public List<ProblemTestCaseVO> replaceHiddenTestCases(long problemId, List<ProblemTestCaseRequest> testCases) {
        Problem problem = requireOwnerOrSuperAdmin(problemId);
        List<ProblemTestCase> entities = new ArrayList<>();
        int index = 1;
        for (ProblemTestCaseRequest item : testCases == null ? List.<ProblemTestCaseRequest>of() : testCases) {
            ProblemTestCase testCase = new ProblemTestCase();
            testCase.problemId = problem.id;
            testCase.caseNo = item.caseNo() == null ? index : item.caseNo();
            testCase.inputData = item.input();
            testCase.outputData = item.output();
            testCase.publicInput = item.publicInput();
            testCase.sample = false;
            entities.add(testCase);
            index++;
        }
        replaceTestCases(problem.id, entities, false);
        /**
         * 封装testCases相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return testCases(problem.id);
    }

    @Transactional
    public ProblemTestCaseVO addTestCase(long problemId, ProblemTestCaseRequest request) {
        Problem problem = requireOwnerOrSuperAdmin(problemId);
        ProblemTestCase testCase = new ProblemTestCase();
        testCase.problemId = problem.id;
        testCase.caseNo = request.caseNo() == null ? nextHiddenCaseNo(problem.id) : request.caseNo();
        testCase.inputData = request.input() == null ? "" : request.input();
        validateExpectedOutput(false, effectiveChecker(problem), request.output(), testCase.caseNo);
        testCase.outputData = request.output() == null ? "" : request.output();
        testCase.publicInput = request.publicInput();
        testCase.sample = false;
        problemTestCaseMapper.insert(testCase);
        redisTemplate.delete(RedisKeys.problem(problemId));
        /**
         * 构造或转换Test测试点VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toTestCaseVO(testCase);
    }

    @Transactional
    public ProblemTestCaseVO updateTestCase(long problemId, long testCaseId, ProblemTestCaseRequest request) {
        Problem problem = requireOwnerOrSuperAdmin(problemId);
        ProblemTestCase testCase = problemTestCaseMapper.selectById(testCaseId);
        if (testCase == null || !Long.valueOf(problemId).equals(testCase.problemId) || Boolean.TRUE.equals(testCase.sample)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(404, "测试点不存在");
        }
        testCase.caseNo = request.caseNo();
        testCase.inputData = request.input() == null ? "" : request.input();
        validateExpectedOutput(false, effectiveChecker(problem), request.output(), testCase.caseNo);
        testCase.outputData = request.output() == null ? "" : request.output();
        testCase.publicInput = request.publicInput();
        problemTestCaseMapper.updateById(testCase);
        problem.updatedAt = LocalDateTime.now();
        problemMapper.updateById(problem);
        redisTemplate.delete(RedisKeys.problem(problemId));
        /**
         * 构造或转换Test测试点VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toTestCaseVO(testCase);
    }

    @Transactional
    public void deleteTestCase(long problemId, long testCaseId) {
        Problem problem = requireOwnerOrSuperAdmin(problemId);
        ProblemTestCase testCase = problemTestCaseMapper.selectById(testCaseId);
        if (testCase == null || !Long.valueOf(problemId).equals(testCase.problemId) || Boolean.TRUE.equals(testCase.sample)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(404, "测试点不存在");
        }
        problemTestCaseMapper.deleteById(testCaseId);
        problem.updatedAt = LocalDateTime.now();
        problemMapper.updateById(problem);
        redisTemplate.delete(RedisKeys.problem(problemId));
    }

    @Transactional
    public void importHiddenTestCases(long problemId, MultipartFile file, boolean overwrite) {
        importHiddenTestCases(problemId, file, overwrite, progress -> {});
    }

    @Transactional
    public void importHiddenTestCases(long problemId, MultipartFile file, boolean overwrite,
                                      Consumer<TestCaseImportProgress> progress) {
        Problem problem = requireOwnerOrSuperAdmin(problemId);
        List<ProblemTestCase> parsed = parseZipTestCases(
            file,
            !requiresExpectedOutput(false, effectiveChecker(problem)), progress
        );
        if (overwrite) {
            replaceTestCases(problem.id, parsed, false, progress);
            problem.updatedAt = LocalDateTime.now();
            problemMapper.updateById(problem);
            return;
        }
        int nextCaseNo = nextHiddenCaseNo(problem.id);
        int saved = 0;
        for (ProblemTestCase testCase : parsed) {
            testCase.problemId = problem.id;
            testCase.sample = false;
            testCase.caseNo = nextCaseNo++;
            validateExpectedOutput(false, effectiveChecker(problem), testCase.outputData, testCase.caseNo);
            testCase.outputData = testCase.outputData == null ? "" : testCase.outputData;
            problemTestCaseMapper.insert(testCase);
            progress.accept(new TestCaseImportProgress("saved", ++saved, parsed.size(), testCase.caseNo));
        }
        problem.updatedAt = LocalDateTime.now();
        problemMapper.updateById(problem);
        redisTemplate.delete(RedisKeys.problem(problem.id));
    }

    private Problem requireOwnerOrSuperAdmin(long id) {
        Problem problem = problemMapper.selectById(id);
        if (problem == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "题目不存在");
        }
        var authUser = CurrentUser.required();
        if (!problemAccessPolicy.can(authUser, Permission.UPDATE, problem)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无访问权限");
        }
        return problem;
    }

    private ProblemVO toVO(Problem problem) {
        return new ProblemVO(
            problem.id,
            problem.title,
            problem.statement,
            problem.inputFormat,
            problem.outputFormat,
            problem.sampleCases,
            problem.timeLimit,
            problem.memoryLimit,
            problem.difficulty,
            readTags(problem.tags),
            problem.ownerId,
            problem.isPublic,
            computedAcRate(problem.id),
            problem.createdAt,
            problem.updatedAt,
            sampleCases(problem.id),
            problemTestCaseMapper.selectCount(
                new QueryWrapper<ProblemTestCase>().eq("problem_id", problem.id).eq("sample", false)
            ),
            ownerName(problem.ownerId, problem.ownerAccountType),
            null,
            isSpecialJudge(problem.checkerSource)
        ).withCommunication(CommunicationConfig.info(problem.communicationConfig));
    }

    private PublicProblemVO toPublicVO(Problem problem) {
        return new PublicProblemVO(
            problem.id,
            problem.title,
            problem.statement,
            problem.inputFormat,
            problem.outputFormat,
            problem.sampleCases,
            problem.timeLimit,
            problem.memoryLimit,
            problem.difficulty,
            readTags(problem.tags),
            problem.folderId,
            folderName(problem.folderId),
            computedAcRate(problem.id),
            problem.createdAt,
            sampleCases(problem.id),
            problemTestCaseMapper.selectCount(
                new QueryWrapper<ProblemTestCase>().eq("problem_id", problem.id).eq("sample", false)
            ),
            ownerName(problem.ownerId, problem.ownerAccountType),
            null,
            isSpecialJudge(problem.checkerSource)
        ).withCommunication(CommunicationConfig.info(problem.communicationConfig));
    }

    private AdminProblemVO toAdminVO(Problem problem) {
        AuthUser user = CurrentUser.get();
        boolean owner = user != null && resourceAccessService.isOwner(user, problem.ownerAccountType, problem.ownerId);
        Long totalSubmissions = submissionMapper.countByProblemId(problem.id);
        Long acceptedSubmissions = submissionMapper.countAcceptedByProblemId(problem.id);
        BigDecimal acRate = (totalSubmissions == null || totalSubmissions == 0)
            ? BigDecimal.ZERO
            : BigDecimal.valueOf((int) Math.round((acceptedSubmissions == null ? 0 : acceptedSubmissions) * 100.0 / totalSubmissions));
        return new AdminProblemVO(
            problem.id,
            problem.title,
            problem.statement,
            problem.inputFormat,
            problem.outputFormat,
            problem.sampleCases,
            problem.timeLimit,
            problem.memoryLimit,
            problem.difficulty,
            readTags(problem.tags),
            problem.folderId,
            folderName(problem.folderId),
            acRate,
            totalSubmissions == null ? 0L : totalSubmissions,
            acceptedSubmissions == null ? 0L : acceptedSubmissions,
            problem.createdAt,
            sampleCases(problem.id),
            problemTestCaseMapper.selectCount(
                new QueryWrapper<ProblemTestCase>().eq("problem_id", problem.id).eq("sample", false)
            ),
            ownerName(problem.ownerId, problem.ownerAccountType),
            null,
            problem.ownerId,
            problem.isPublic,
            problem.updatedAt,
            problem.ownerAccountType,
            problem.accessScope,
            problem.majorId,
            majorName(problem.majorId),
            problem.studentPublishStatus,
            owner,
            owner || resourceAccessService.isSuperAdmin(user),
            isSpecialJudge(problem.checkerSource)
        ).withCommunication(CommunicationConfig.info(problem.communicationConfig));
    }

    private AdminProblemVO toAdminVOForUpdate(Problem problem) {
        AuthUser user = CurrentUser.get();
        boolean owner = user != null && resourceAccessService.isOwner(user, problem.ownerAccountType, problem.ownerId);
        return new AdminProblemVO(
            problem.id,
            problem.title,
            problem.statement,
            problem.inputFormat,
            problem.outputFormat,
            problem.sampleCases,
            problem.timeLimit,
            problem.memoryLimit,
            problem.difficulty,
            readTags(problem.tags),
            problem.folderId,
            folderName(problem.folderId),
            problem.acRate == null ? BigDecimal.ZERO : problem.acRate,
            null,
            null,
            problem.createdAt,
            sampleCases(problem.id),
            problemTestCaseMapper.selectCount(
                new QueryWrapper<ProblemTestCase>().eq("problem_id", problem.id).eq("sample", false)
            ),
            "",
            null,
            problem.ownerId,
            problem.isPublic,
            problem.updatedAt,
            problem.ownerAccountType,
            problem.accessScope,
            problem.majorId,
            majorName(problem.majorId),
            problem.studentPublishStatus,
            owner,
            owner || resourceAccessService.isSuperAdmin(user),
            isSpecialJudge(problem.checkerSource)
        ).withCommunication(CommunicationConfig.info(problem.communicationConfig));
    }

    private List<PublicProblemVO> withPublicAttemptStatuses(List<PublicProblemVO> problems, Long userId) {
        if (userId == null || problems.isEmpty()) {
            return problems;
        }
        List<Long> problemIds = problems.stream().map(PublicProblemVO::id).toList();
        Map<Long, String> statusByProblemId = userProblemStatusMapper
            .selectList(
                new QueryWrapper<UserProblemStatus>()
                    .eq("user_id", userId)
                    .in("problem_id", problemIds)
            )
            .stream()
            .collect(Collectors.toMap(item -> item.problemId, item -> item.bestStatus, (left, right) -> left));
        fillAttemptStatusesFromSubmissions(statusByProblemId, userId, problemIds);
        return problems.stream().map(item -> withPublicAttemptStatus(item, statusByProblemId.get(item.id()))).toList();
    }

    private PublicProblemVO withPublicAttemptStatus(PublicProblemVO vo, String attemptStatus) {
        return new PublicProblemVO(
            vo.id(),
            vo.title(),
            vo.statement(),
            vo.inputFormat(),
            vo.outputFormat(),
            vo.sampleCases(),
            vo.timeLimit(),
            vo.memoryLimit(),
            vo.difficulty(),
            vo.tags(),
            vo.folderId(),
            vo.folderName(),
            vo.acRate(),
            vo.createdAt(),
            vo.samples(),
            vo.testCaseCount(),
            vo.ownerName(),
            attemptStatus,
            vo.specialJudge()
        ).withCommunication(vo.communication());
    }

    private AdminProblemVO withAdminAttemptStatus(AdminProblemVO vo, String attemptStatus) {
        return new AdminProblemVO(
            vo.id(),
            vo.title(),
            vo.statement(),
            vo.inputFormat(),
            vo.outputFormat(),
            vo.sampleCases(),
            vo.timeLimit(),
            vo.memoryLimit(),
            vo.difficulty(),
            vo.tags(),
            vo.folderId(),
            vo.folderName(),
            vo.acRate(),
            vo.submissionCount(),
            vo.acceptedCount(),
            vo.createdAt(),
            vo.samples(),
            vo.testCaseCount(),
            vo.ownerName(),
            attemptStatus,
            vo.ownerId(),
            vo.isPublic(),
            vo.updatedAt(),
            vo.ownerAccountType(),
            vo.accessScope(),
            vo.majorId(),
            vo.majorName(),
            vo.studentPublishStatus(),
            vo.owner(),
            vo.canEdit(),
            vo.specialJudge()
        ).withCommunication(vo.communication());
    }

    private String attemptStatus(Long userId, Long problemId) {
        if (userId == null || problemId == null) {
            return null;
        }
        UserProblemStatus status = userProblemStatusMapper.selectOne(
            new QueryWrapper<UserProblemStatus>()
                .eq("user_id", userId)
                .eq("problem_id", problemId)
        );
        if (status != null && status.bestStatus != null && !status.bestStatus.isBlank()) {
            return status.bestStatus;
        }
        /**
         * 封装attempt状态FromSubmissions相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return attemptStatusFromSubmissions(userId, problemId);
    }

    private void fillAttemptStatusesFromSubmissions(Map<Long, String> statusByProblemId, Long userId, List<Long> problemIds) {
        if (problemIds.isEmpty()) {
            return;
        }
        submissionMapper
            .selectList(
                new QueryWrapper<Submission>()
                    .eq("user_id", userId)
                    .in("problem_id", problemIds)
                    .isNull("contest_id")
                    .orderByDesc("created_at")
                    .orderByDesc("id")
            )
            .forEach(submission -> {
                String current = statusByProblemId.get(submission.problemId);
                if (SubmissionStatus.AC.name().equals(current)) {
                    return;
                }
                if (SubmissionStatus.AC.name().equals(submission.status) || current == null) {
                    statusByProblemId.put(submission.problemId, submission.status);
                }
            });
    }

    private String attemptStatusFromSubmissions(Long userId, Long problemId) {
        List<Submission> submissions = submissionMapper.selectList(
            new QueryWrapper<Submission>()
                .eq("user_id", userId)
                .eq("problem_id", problemId)
                .isNull("contest_id")
                .orderByDesc("created_at")
                .orderByDesc("id")
        );
        if (submissions.isEmpty()) {
            return null;
        }
        if (submissions.stream().anyMatch(item -> SubmissionStatus.AC.name().equals(item.status))) {
            return SubmissionStatus.AC.name();
        }
        return submissions.get(0).status;
    }

    private ProblemVO withAttemptStatus(ProblemVO vo, String attemptStatus) {
        return new ProblemVO(
            vo.id(),
            vo.title(),
            vo.statement(),
            vo.inputFormat(),
            vo.outputFormat(),
            vo.sampleCases(),
            vo.timeLimit(),
            vo.memoryLimit(),
            vo.difficulty(),
            vo.tags(),
            vo.ownerId(),
            vo.isPublic(),
            vo.acRate(),
            vo.createdAt(),
            vo.updatedAt(),
            vo.samples(),
            vo.testCaseCount(),
            vo.ownerName(),
            attemptStatus,
            vo.specialJudge()
        ).withCommunication(vo.communication());
    }

    private BigDecimal computedAcRate(Long problemId) {
        Long total = submissionMapper.countByProblemId(problemId);
        if (total == null || total == 0) {
            return BigDecimal.ZERO;
        }
        Long accepted = submissionMapper.countAcceptedByProblemId(problemId);
        int rate = (int) Math.round((accepted == null ? 0 : accepted) * 100.0 / total);
        return BigDecimal.valueOf(rate);
    }

    private Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthUser authUser) {
            if (!"USER".equals(authUser.accountType())) {
                return null;
            }
            return authUser.id();
        }
        return null;
    }

    private String writeTags(List<String> tags) {
        try {
            return objectMapper.writeValueAsString(tags == null ? List.of() : tags);
        } catch (JsonProcessingException ex) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "标签格式错误");
        }
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

    private List<ProblemSampleCaseVO> sampleCases(Long problemId) {
        return problemTestCaseMapper
            .selectList(
                new QueryWrapper<ProblemTestCase>()
                    .eq("problem_id", problemId)
                    .eq("sample", true)
                    .orderByAsc("case_no")
            )
            .stream()
            .map(item -> new ProblemSampleCaseVO(item.caseNo, item.inputData, item.outputData, item.explanation))
            .toList();
    }

    private List<ProblemSampleCaseRequest> resolveSamples(ProblemUpdateRequest request) {
        if (request.samples() != null) {
            return request.samples();
        }
        if (request.sampleCases() == null || request.sampleCases().isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(request.sampleCases(), new TypeReference<List<ProblemSampleCaseRequest>>() {});
        } catch (Exception ex) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "样例格式错误");
        }
    }

    private String writeSampleCases(List<ProblemSampleCaseRequest> samples) {
        try {
            return objectMapper.writeValueAsString(samples == null ? List.of() : samples);
        } catch (JsonProcessingException ex) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "样例格式错误");
        }
    }

    private List<ProblemTestCase> sampleEntities(List<ProblemSampleCaseRequest> samples) {
        if (samples == null) {
            return List.of();
        }
        List<ProblemTestCase> result = new ArrayList<>();
        int index = 1;
        for (ProblemSampleCaseRequest sample : samples) {
            if (sample == null) {
                continue;
            }
            if (sample.input() == null || sample.output() == null) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(400, "样例输入输出字段不能缺失，空数据请填写空字符串");
            }
            ProblemTestCase testCase = new ProblemTestCase();
            testCase.caseNo = index++;
            testCase.inputData = sample.input();
            testCase.outputData = sample.output();
            testCase.explanation = sample.explanation();
            result.add(testCase);
        }
        return result;
    }

    private ProblemTestCaseVO toTestCaseVO(ProblemTestCase item) {
        /**
         * 封装题目Test测试点VO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new ProblemTestCaseVO(
            item.id,
            item.caseNo,
            item.inputData,
            item.outputData,
            item.explanation,
            item.sample,
            item.publicInput
        );
    }

    private String ownerName(Long ownerId, String ownerAccountType) {
        if (ownerId == null) {
            return "";
        }
        String type = resourceAccessService.normalizeOwnerType(ownerAccountType);
        if ("ADMIN".equals(type)) {
            AdminUser adminUser = adminUserMapper.selectById(ownerId);
            return adminUser == null ? "" : adminUser.displayName;
        }
        if ("TEACHER".equals(type)) {
            Teacher teacher = teacherMapper.selectById(ownerId);
            return teacher == null ? "" : teacher.displayName;
        }
        User user = userMapper.selectById(ownerId);
        return user == null ? "" : user.displayName;
    }

    private boolean isOwner(Problem problem, AuthUser user) {
        return resourceAccessService.isOwner(user, problem.ownerAccountType, problem.ownerId);
    }

    private String normalizePublishStatus(String value, Boolean legacyPublic) {
        String status = value == null
            ? (Boolean.FALSE.equals(legacyPublic) ? "DRAFT" : "PUBLISHED")
            : value.trim().toUpperCase();
        if (!Set.of("DRAFT", "PUBLISHED").contains(status)) {
            throw new BizException(400, "题目发布状态无效");
        }
        return status;
    }

    private String majorName(Long majorId) {
        if (majorId == null) {
            return null;
        }
        Major major = majorMapper.selectById(majorId);
        return major == null ? null : major.name;
    }

    private String folderName(Long folderId) {
        if (folderId == null) return "";
        ProblemFolder folder = problemFolderMapper.selectById(folderId);
        return folder == null ? "" : folder.name;
    }

    private int nextHiddenCaseNo(Long problemId) {
        return problemTestCaseMapper.selectList(
                new QueryWrapper<ProblemTestCase>()
                    .eq("problem_id", problemId)
                    .eq("sample", false)
                    .orderByDesc("case_no")
                    .last("LIMIT 1")
            )
            .stream()
            .findFirst()
            .map(item -> item.caseNo + 1)
            .orElse(1);
    }

    private void ensureHiddenTestCasesHaveExpectedOutput(Problem problem, String checkerSource) {
        if (!requiresExpectedOutput(false, checkerSource)) {
            return;
        }
        boolean hasBlankOutput = problemTestCaseMapper.selectList(
            new QueryWrapper<ProblemTestCase>()
                .eq("problem_id", problem.id)
                .eq("sample", false)
        ).stream().anyMatch(item -> item.outputData == null || item.outputData.isBlank());
        if (hasBlankOutput) {
            throw new BizException(400, "当前存在空输出测试点，不能关闭 SPJ");
        }
    }

    private List<ProblemTestCase> parseZipTestCases(MultipartFile file, boolean allowMissingOutput, Consumer<TestCaseImportProgress> progress) {
        TestCaseZipReader.validateUpload(file);
        List<ProblemTestCaseRequest> parsed = TestCaseZipReader.read(file, allowMissingOutput, progress, "ZIP 中未找到测试点");
        List<ProblemTestCase> testCases = new ArrayList<>();
        for (ProblemTestCaseRequest item : parsed) {
            ProblemTestCase testCase = new ProblemTestCase();
            testCase.caseNo = item.caseNo();
            testCase.inputData = item.input();
            testCase.publicInput = item.publicInput();
            testCase.outputData = item.output();
            testCases.add(testCase);
        }
        return testCases;
    }
}

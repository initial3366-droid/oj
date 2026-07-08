package com.qoj.module.problem.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.ErrorCode;
import com.qoj.common.PageResult;
import com.qoj.common.enums.SubmissionStatus;
import com.qoj.common.exception.BizException;
import com.qoj.common.redis.RedisKeys;
import com.qoj.module.judge.service.DomjudgeAdapter;
import com.qoj.module.problem.dto.ProblemTestCaseRequest;
import com.qoj.module.problem.dto.ProblemSampleCaseRequest;
import com.qoj.module.problem.dto.ProblemUpdateRequest;
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
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.AdminUserMapper;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ProblemService {
    private static final int MAX_ZIP_TEST_CASES = 200;
    private static final int MAX_ZIP_ENTRIES = 500;
    private static final int MAX_ZIP_ENTRY_BYTES = 2 * 1024 * 1024;
    private static final int MAX_ZIP_TOTAL_BYTES = 50 * 1024 * 1024;

    private final ProblemMapper problemMapper;
    private final ProblemTestCaseMapper problemTestCaseMapper;
    private final SubmissionMapper submissionMapper;
    private final UserProblemStatusMapper userProblemStatusMapper;
    private final UserMapper userMapper;
    private final AdminUserMapper adminUserMapper;
    private final ObjectMapper objectMapper;
    private final DomjudgeAdapter domjudgeAdapter;
    private final StringRedisTemplate redisTemplate;
    private final com.qoj.security.policy.ProblemAccessPolicy problemAccessPolicy;
    private final ProblemFolderMapper problemFolderMapper;

    public ProblemService(
        ProblemMapper problemMapper,
        ProblemTestCaseMapper problemTestCaseMapper,
        SubmissionMapper submissionMapper,
        UserProblemStatusMapper userProblemStatusMapper,
        UserMapper userMapper,
        AdminUserMapper adminUserMapper,
        ObjectMapper objectMapper,
        DomjudgeAdapter domjudgeAdapter,
        StringRedisTemplate redisTemplate,
        com.qoj.security.policy.ProblemAccessPolicy problemAccessPolicy,
        ProblemFolderMapper problemFolderMapper
    ) {
        this.problemMapper = problemMapper;
        this.problemTestCaseMapper = problemTestCaseMapper;
        this.submissionMapper = submissionMapper;
        this.userProblemStatusMapper = userProblemStatusMapper;
        this.userMapper = userMapper;
        this.adminUserMapper = adminUserMapper;
        this.objectMapper = objectMapper;
        this.domjudgeAdapter = domjudgeAdapter;
        this.redisTemplate = redisTemplate;
        this.problemAccessPolicy = problemAccessPolicy;
        this.problemFolderMapper = problemFolderMapper;
    }

    public PageResult<PublicProblemVO> list(int page, int pageSize, String keyword, Integer difficulty, String tag) {
        QueryWrapper<Problem> wrapper = new QueryWrapper<>();
        wrapper.eq("is_deleted", false);
        wrapper.eq("is_public", true);
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
        if (!"SUPER_ADMIN".equals(user.role())) {
            wrapper.eq("owner_id", user.id());
        }
        if (keyword != null && !keyword.isBlank()) {
            wrapper.and(w -> w.like("title", keyword).or().like("statement", keyword));
        }
        if (difficulty != null) {
            wrapper.eq("difficulty", difficulty);
        }
        if (tag != null && !tag.isBlank()) {
            wrapper.like("tags", tag);
        }
        if (folderId != null) {
            wrapper.eq("folder_id", folderId);
        }
        if (ownerName != null && !ownerName.isBlank()) {
            String normalizedOwnerName = ownerName.trim();
            wrapper.and(w -> w
                .apply("owner_id IN (SELECT id FROM users WHERE display_name LIKE CONCAT('%', {0}, '%'))", normalizedOwnerName)
                .or()
                .apply("owner_id IN (SELECT id FROM admin_users WHERE display_name LIKE CONCAT('%', {0}, '%'))", normalizedOwnerName)
            );
        }
        wrapper.orderByDesc("created_at");
        Page<Problem> result = problemMapper.selectPage(Page.of(page, pageSize), wrapper);
        return new PageResult<>(result.getTotal(), result.getRecords().stream().map(this::toAdminVO).toList());
    }

    public Object detail(long id) {
        Problem problem = problemMapper.selectById(id);
        if (problem == null) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "题目不存在");
        }

        // 检查软删除状态
        AuthUser user = CurrentUser.get();
        if (Boolean.TRUE.equals(problem.isDeleted)) {
            // 只有SUPER_ADMIN和创建者可以查看已删除的题目
            if (user == null || (!"SUPER_ADMIN".equals(user.role()) && !problem.ownerId.equals(user.id()))) {
                throw new BizException(ErrorCode.NOT_FOUND.getCode(), "题目不存在");
            }
        }

        // 使用Policy检查查看权限
        if (!problemAccessPolicy.can(user, com.qoj.security.policy.Permission.VIEW, problem)) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "题目不存在");
        }

        // 如果用户有管理权限，返回AdminProblemVO，否则返回PublicProblemVO
        boolean isAdmin = user != null && problemAccessPolicy.can(user, com.qoj.security.policy.Permission.UPDATE, problem);

        if (isAdmin) {
            return withAdminAttemptStatus(toAdminVO(problem), attemptStatus(currentUserId(), problem.id));
        } else {
            return withPublicAttemptStatus(toPublicVO(problem), attemptStatus(currentUserId(), problem.id));
        }
    }

    public PublicProblemVO publicDetail(long id) {
        Problem problem = problemMapper.selectById(id);
        if (problem == null) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "题目不存在");
        }

        // 检查软删除状态
        if (Boolean.TRUE.equals(problem.isDeleted)) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "题目不存在");
        }

        // 只返回公开题目或用户有权限的题目
        AuthUser user = CurrentUser.get();
        if (!problemAccessPolicy.can(user, com.qoj.security.policy.Permission.VIEW, problem)) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "题目不存在");
        }

        return withPublicAttemptStatus(toPublicVO(problem), attemptStatus(currentUserId(), problem.id));
    }

    /**
     * 获取题目详情，返回ProblemVO（包含所有字段）
     * 用于内部模块调用（如Practice、Contest、Home等）
     */
    public ProblemVO detailAsVO(long id) {
        Problem problem = problemMapper.selectById(id);
        if (problem == null) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "题目不存在");
        }

        // 检查软删除状态
        AuthUser user = CurrentUser.get();
        if (Boolean.TRUE.equals(problem.isDeleted)) {
            // 只有SUPER_ADMIN和创建者可以查看已删除的题目
            if (user == null || (!"SUPER_ADMIN".equals(user.role()) && !problem.ownerId.equals(user.id()))) {
                throw new BizException(ErrorCode.NOT_FOUND.getCode(), "题目不存在");
            }
        }

        // 使用Policy检查查看权限
        if (!problemAccessPolicy.can(user, com.qoj.security.policy.Permission.VIEW, problem)) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "题目不存在");
        }

        return withAttemptStatus(toVO(problem), attemptStatus(currentUserId(), problem.id));
    }

    public ProblemVO detailAsVOUnchecked(long id) {
        Problem problem = problemMapper.selectById(id);
        if (problem == null || Boolean.TRUE.equals(problem.isDeleted)) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "题目不存在");
        }
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
        problem.isPublic = !Boolean.FALSE.equals(request.isPublic());
        problemMapper.updateById(problem);
        replaceTestCases(problem.id, sampleEntities(samples), true);
        redisTemplate.delete(RedisKeys.problem(problem.id));
        Problem updated = problemMapper.selectById(problem.id);
        return toAdminVOForUpdate(updated == null ? problem : updated);
    }

    @Transactional
    public void delete(long id) {
        Problem problem = requireOwnerOrSuperAdmin(id);
        // 软删除
        problem.isDeleted = true;
        problem.deletedAt = java.time.LocalDateTime.now();
        problemMapper.updateById(problem);
        redisTemplate.delete(RedisKeys.problem(problem.id));
    }

    public void replaceTestCases(Long problemId, List<ProblemTestCase> testCases, boolean sample) {
        List<ProblemTestCase> normalized = normalizeReplacementTestCases(problemId, testCases, sample);
        problemTestCaseMapper.delete(
            new QueryWrapper<ProblemTestCase>().eq("problem_id", problemId).eq("sample", sample)
        );
        for (ProblemTestCase testCase : normalized) {
            problemTestCaseMapper.insert(testCase);
        }
        redisTemplate.delete(RedisKeys.problem(problemId));
    }

    private List<ProblemTestCase> normalizeReplacementTestCases(
        Long problemId,
        List<ProblemTestCase> testCases,
        boolean sample
    ) {
        List<ProblemTestCase> normalized = new java.util.ArrayList<>();
        Set<Integer> usedCaseNos = new HashSet<>();
        int nextCaseNo = 1;
        for (ProblemTestCase item : testCases == null ? List.<ProblemTestCase>of() : testCases) {
            if (item == null) {
                continue;
            }
            int caseNo = item.caseNo == null ? nextCaseNo : item.caseNo;
            while (usedCaseNos.contains(caseNo)) {
                if (item.caseNo != null) {
                    throw new BizException(400, "测试点编号 " + item.caseNo + " 重复");
                }
                caseNo++;
            }
            if (caseNo <= 0) {
                throw new BizException(400, "测试点编号必须大于 0");
            }
            if (item.inputData == null || item.inputData.isBlank()) {
                throw new BizException(400, (sample ? "样例" : "测试点") + " " + caseNo + " 的输入数据不能为空");
            }
            if (item.outputData == null || item.outputData.isBlank()) {
                throw new BizException(400, (sample ? "样例" : "测试点") + " " + caseNo + " 的输出数据不能为空");
            }
            usedCaseNos.add(caseNo);
            nextCaseNo = Math.max(nextCaseNo, caseNo + 1);

            ProblemTestCase testCase = new ProblemTestCase();
            testCase.id = null;
            testCase.problemId = problemId;
            testCase.sample = sample;
            testCase.caseNo = caseNo;
            testCase.inputData = item.inputData;
            testCase.outputData = item.outputData;
            testCase.explanation = item.explanation;
            normalized.add(testCase);
        }
        return normalized;
    }

    public List<ProblemTestCaseVO> testCases(long problemId) {
        Problem problem = problemMapper.selectById(problemId);
        if (problem == null) {
            throw new BizException(404, "题目不存在");
        }
        AuthUser user = CurrentUser.required();
        if (!problemAccessPolicy.can(user, com.qoj.security.policy.Permission.VIEW_HIDDEN_CASE, problem)) {
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
        List<ProblemTestCase> entities = new java.util.ArrayList<>();
        int index = 1;
        for (ProblemTestCaseRequest item : testCases == null ? List.<ProblemTestCaseRequest>of() : testCases) {
            ProblemTestCase testCase = new ProblemTestCase();
            testCase.problemId = problem.id;
            testCase.caseNo = item.caseNo() == null ? index : item.caseNo();
            testCase.inputData = item.input();
            testCase.outputData = item.output();
            testCase.sample = false;
            entities.add(testCase);
            index++;
        }
        replaceTestCases(problem.id, entities, false);
        return testCases(problem.id);
    }

    @Transactional
    public ProblemTestCaseVO addTestCase(long problemId, com.qoj.module.problem.dto.ProblemTestCaseRequest request) {
        Problem problem = requireOwnerOrSuperAdmin(problemId);
        ProblemTestCase testCase = new ProblemTestCase();
        testCase.problemId = problem.id;
        testCase.caseNo = request.caseNo() == null ? nextHiddenCaseNo(problem.id) : request.caseNo();
        testCase.inputData = request.input();
        testCase.outputData = request.output();
        testCase.sample = false;
        problemTestCaseMapper.insert(testCase);
        redisTemplate.delete(RedisKeys.problem(problemId));
        return toTestCaseVO(testCase);
    }

    @Transactional
    public ProblemTestCaseVO updateTestCase(long problemId, long testCaseId, com.qoj.module.problem.dto.ProblemTestCaseRequest request) {
        requireOwnerOrSuperAdmin(problemId);
        ProblemTestCase testCase = problemTestCaseMapper.selectById(testCaseId);
        if (testCase == null || !Long.valueOf(problemId).equals(testCase.problemId) || Boolean.TRUE.equals(testCase.sample)) {
            throw new BizException(404, "测试点不存在");
        }
        testCase.caseNo = request.caseNo();
        testCase.inputData = request.input();
        testCase.outputData = request.output();
        problemTestCaseMapper.updateById(testCase);
        redisTemplate.delete(RedisKeys.problem(problemId));
        return toTestCaseVO(testCase);
    }

    @Transactional
    public void deleteTestCase(long problemId, long testCaseId) {
        requireOwnerOrSuperAdmin(problemId);
        ProblemTestCase testCase = problemTestCaseMapper.selectById(testCaseId);
        if (testCase == null || !Long.valueOf(problemId).equals(testCase.problemId) || Boolean.TRUE.equals(testCase.sample)) {
            throw new BizException(404, "测试点不存在");
        }
        problemTestCaseMapper.deleteById(testCaseId);
        redisTemplate.delete(RedisKeys.problem(problemId));
    }

    @Transactional
    public void importHiddenTestCases(long problemId, MultipartFile file, boolean overwrite) {
        Problem problem = requireOwnerOrSuperAdmin(problemId);
        List<ProblemTestCase> parsed = parseZipTestCases(file);
        if (overwrite) {
            replaceHiddenTestCases(problem.id, parsed);
            return;
        }
        int nextCaseNo = nextHiddenCaseNo(problem.id);
        for (ProblemTestCase testCase : parsed) {
            testCase.problemId = problem.id;
            testCase.sample = false;
            testCase.caseNo = nextCaseNo++;
            problemTestCaseMapper.insert(testCase);
        }
        redisTemplate.delete(RedisKeys.problem(problem.id));
    }

    private void replaceHiddenTestCases(Long problemId, List<ProblemTestCase> testCases) {
        replaceTestCases(problemId, testCases, false);
    }

    private Problem requireOwnerOrSuperAdmin(long id) {
        Problem problem = problemMapper.selectById(id);
        if (problem == null) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "题目不存在");
        }
        var authUser = CurrentUser.required();
        if (!problemAccessPolicy.can(authUser, com.qoj.security.policy.Permission.UPDATE, problem)) {
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无访问权限");
        }
        return problem;
    }

    private Problem requirePublicManageOwner(long id) {
        Problem problem = requireOwnerOrSuperAdmin(id);
        String role = CurrentUser.required().role();
        if (!"SUPER_ADMIN".equals(role) && !"TEACHER".equals(role)) {
            throw new BizException(ErrorCode.FORBIDDEN.getCode(), "无公开题目权限");
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
            problem.domjudgeProblemId,
            computedAcRate(problem.id),
            problem.createdAt,
            problem.updatedAt,
            sampleCases(problem.id),
            problemTestCaseMapper.selectCount(
                new QueryWrapper<ProblemTestCase>().eq("problem_id", problem.id).eq("sample", false)
            ),
            ownerName(problem.ownerId),
            null
        );
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
            ownerName(problem.ownerId),
            null
        );
    }

    private AdminProblemVO toAdminVO(Problem problem) {
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
            computedAcRate(problem.id),
            problem.createdAt,
            sampleCases(problem.id),
            problemTestCaseMapper.selectCount(
                new QueryWrapper<ProblemTestCase>().eq("problem_id", problem.id).eq("sample", false)
            ),
            ownerName(problem.ownerId),
            null,
            problem.ownerId,
            problem.isPublic,
            problem.domjudgeProblemId,
            problem.updatedAt
        );
    }

    private AdminProblemVO toAdminVOForUpdate(Problem problem) {
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
            problem.createdAt,
            sampleCases(problem.id),
            problemTestCaseMapper.selectCount(
                new QueryWrapper<ProblemTestCase>().eq("problem_id", problem.id).eq("sample", false)
            ),
            "",
            null,
            problem.ownerId,
            problem.isPublic,
            problem.domjudgeProblemId,
            problem.updatedAt
        );
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
            attemptStatus
        );
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
            vo.createdAt(),
            vo.samples(),
            vo.testCaseCount(),
            vo.ownerName(),
            attemptStatus,
            vo.ownerId(),
            vo.isPublic(),
            vo.domjudgeProblemId(),
            vo.updatedAt()
        );
    }

    private List<ProblemVO> withAttemptStatuses(List<ProblemVO> problems, Long userId) {
        if (userId == null || problems.isEmpty()) {
            return problems;
        }
        List<Long> problemIds = problems.stream().map(ProblemVO::id).toList();
        Map<Long, String> statusByProblemId = userProblemStatusMapper
            .selectList(
                new QueryWrapper<UserProblemStatus>()
                    .eq("user_id", userId)
                    .in("problem_id", problemIds)
            )
            .stream()
            .collect(Collectors.toMap(item -> item.problemId, item -> item.bestStatus, (left, right) -> left));
        fillAttemptStatusesFromSubmissions(statusByProblemId, userId, problemIds);
        return problems.stream().map(item -> withAttemptStatus(item, statusByProblemId.get(item.id()))).toList();
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
            vo.domjudgeProblemId(),
            vo.acRate(),
            vo.createdAt(),
            vo.updatedAt(),
            vo.samples(),
            vo.testCaseCount(),
            vo.ownerName(),
            attemptStatus
        );
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
            if (authUser.adminAccount()) {
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

    private List<ProblemTestCase> sampleEntities(String sampleCases) {
        if (sampleCases == null || sampleCases.isBlank()) {
            return List.of();
        }
        List<ProblemSampleCaseRequest> samples;
        try {
            samples = objectMapper.readValue(sampleCases, new TypeReference<List<ProblemSampleCaseRequest>>() {});
        } catch (Exception ex) {
            throw new BizException(400, "样例格式错误");
        }
        List<ProblemTestCase> result = new java.util.ArrayList<>();
        int index = 1;
        for (ProblemSampleCaseRequest sample : samples) {
            boolean hasInput = sample.input() != null && !sample.input().isBlank();
            boolean hasOutput = sample.output() != null && !sample.output().isBlank();
            if (!hasInput && !hasOutput) {
                continue;
            }
            if (!hasInput || !hasOutput) {
                throw new BizException(400, "样例输入输出必须同时填写");
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
            throw new BizException(400, "样例格式错误");
        }
    }

    private String writeSampleCases(List<ProblemSampleCaseRequest> samples) {
        try {
            return objectMapper.writeValueAsString(samples == null ? List.of() : samples);
        } catch (JsonProcessingException ex) {
            throw new BizException(400, "样例格式错误");
        }
    }

    private List<ProblemTestCase> sampleEntities(List<ProblemSampleCaseRequest> samples) {
        if (samples == null) {
            return List.of();
        }
        List<ProblemTestCase> result = new java.util.ArrayList<>();
        int index = 1;
        for (ProblemSampleCaseRequest sample : samples) {
            if (sample == null) {
                continue;
            }
            boolean hasInput = sample.input() != null && !sample.input().isBlank();
            boolean hasOutput = sample.output() != null && !sample.output().isBlank();
            if (!hasInput && !hasOutput) {
                continue;
            }
            if (!hasInput || !hasOutput) {
                throw new BizException(400, "样例输入输出必须同时填写");
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
        return new ProblemTestCaseVO(
            item.id,
            item.caseNo,
            item.inputData,
            item.outputData,
            item.explanation,
            item.sample
        );
    }

    private String ownerName(Long ownerId) {
        if (ownerId == null) {
            return "";
        }
        User user = userMapper.selectById(ownerId);
        if (user != null) {
            return user.displayName;
        }
        AdminUser adminUser = adminUserMapper.selectById(ownerId);
        return adminUser == null ? "" : adminUser.displayName;
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

    private List<ProblemTestCase> parseZipTestCases(MultipartFile file) {
        Map<Integer, String> inputs = new HashMap<>();
        Map<Integer, String> outputs = new HashMap<>();
        int[] counters = new int[] {0, 0};
        try (ZipInputStream zip = new ZipInputStream(file.getInputStream())) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (entry.isDirectory()) {
                    continue;
                }
                if (++counters[0] > MAX_ZIP_ENTRIES) {
                    throw new BizException(400, "测试点 ZIP 文件数量过多");
                }
                String name = safeZipEntryName(entry.getName());
                Integer caseNo = caseNumber(name);
                if (caseNo == null) {
                    continue;
                }
                if (inputs.size() + outputs.size() >= MAX_ZIP_TEST_CASES * 2) {
                    throw new BizException(400, "测试点数量过多");
                }
                String content = readZipEntryText(zip, counters);
                if (name.endsWith(".in")) {
                    inputs.put(caseNo, content);
                } else if (name.endsWith(".out")) {
                    outputs.put(caseNo, content);
                }
            }
        } catch (BizException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BizException(400, "测试点 ZIP 解析失败");
        }
        TreeSet<Integer> caseNos = new TreeSet<>(inputs.keySet());
        if (caseNos.isEmpty()) {
            throw new BizException(400, "ZIP 中未找到测试点");
        }
        List<ProblemTestCase> testCases = new java.util.ArrayList<>();
        for (Integer caseNo : caseNos) {
            String input = inputs.get(caseNo);
            String output = outputs.get(caseNo);
            if (output == null) {
                throw new BizException(400, caseNo + ".out 缺失");
            }
            ProblemTestCase testCase = new ProblemTestCase();
            testCase.caseNo = caseNo;
            testCase.inputData = input;
            testCase.outputData = output;
            testCases.add(testCase);
        }
        return testCases;
    }

    private String safeZipEntryName(String rawName) {
        String name = rawName == null ? "" : rawName.replace('\\', '/');
        if (name.contains("../") || name.startsWith("/")) {
            throw new BizException(400, "测试点 ZIP 包含非法路径");
        }
        int slash = name.lastIndexOf('/');
        if (slash >= 0) {
            name = name.substring(slash + 1);
        }
        return name;
    }

    private String readZipEntryText(ZipInputStream zip, int[] counters) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int entryBytes = 0;
        int read;
        while ((read = zip.read(buffer)) != -1) {
            entryBytes += read;
            counters[1] += read;
            if (entryBytes > MAX_ZIP_ENTRY_BYTES) {
                throw new BizException(400, "单个测试点文件过大");
            }
            if (counters[1] > MAX_ZIP_TOTAL_BYTES) {
                throw new BizException(400, "测试点 ZIP 解压后过大");
            }
            out.write(buffer, 0, read);
        }
        return out.toString(java.nio.charset.StandardCharsets.UTF_8);
    }

    private Integer caseNumber(String filename) {
        if (!filename.endsWith(".in") && !filename.endsWith(".out")) {
            return null;
        }
        String number = filename.substring(0, filename.lastIndexOf('.'));
        if (!number.matches("\\d+")) {
            return null;
        }
        return Integer.valueOf(number);
    }
}

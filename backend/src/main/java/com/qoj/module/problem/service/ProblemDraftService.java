package com.qoj.module.problem.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.exception.BizException;
import com.qoj.common.redis.RedisKeys;
import com.qoj.module.problem.dto.CommunicationConfig;
import com.qoj.module.problem.dto.ProblemDraftBasicRequest;
import com.qoj.module.problem.dto.ProblemDraftTestCasesRequest;
import com.qoj.module.problem.dto.ProblemDraftVO;
import com.qoj.module.problem.dto.ProblemSampleCaseRequest;
import com.qoj.module.problem.dto.ProblemTestCaseRequest;
import com.qoj.module.problem.dto.TestCaseImportProgress;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.entity.ProblemTestCase;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.vo.ProblemVO;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import com.qoj.security.policy.ResourceAccessService;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Consumer;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * 题目Draft业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class ProblemDraftService {
    private static final Duration DRAFT_TTL = Duration.ofHours(6);
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final ProblemMapper problemMapper;
    private final ProblemService problemService;
    private final ProblemFolderService problemFolderService;
    private final ResourceAccessService resourceAccessService;

    /**
     * 构造 题目DraftService 实例并保存其必要依赖或初始状态。从持久化层读取数据；读写 Redis 中的缓存、锁或限流状态。
     */
    public ProblemDraftService(
        StringRedisTemplate redisTemplate,
        ObjectMapper objectMapper,
        ProblemMapper problemMapper,
        ProblemService problemService,
        ProblemFolderService problemFolderService,
        ResourceAccessService resourceAccessService
    ) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.problemMapper = problemMapper;
        this.problemService = problemService;
        this.problemFolderService = problemFolderService;
        this.resourceAccessService = resourceAccessService;
    }

    public ProblemDraftVO createDraft() {
        String draftId = UUID.randomUUID().toString();
        /**
         * 更新目标数据。执行持久化写入。
         */
        save(new DraftData(null, List.of()), draftId);
        /**
         * 封装题目DraftVO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new ProblemDraftVO(draftId, null, List.of());
    }

    public ProblemDraftVO saveBasic(String draftId, ProblemDraftBasicRequest request) {
        CommunicationConfig.encode(request.communication());
        DraftData draft = loadOrNew(draftId);
        List<ProblemTestCaseRequest> testCases = normalizeCases(draft.testCases());
        validateHiddenTestCases(request, testCases);
        draft = new DraftData(request, testCases);
        /**
         * 更新目标数据。执行持久化写入。
         */
        save(draft, draftId);
        /**
         * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toVO(draftId, draft);
    }

    public ProblemDraftVO saveTestCases(String draftId, ProblemDraftTestCasesRequest request) {
        DraftData draft = requireDraft(draftId);
        List<ProblemTestCaseRequest> testCases = normalizeCases(request.testCases());
        validateHiddenTestCases(draft.basic(), testCases);
        draft = new DraftData(draft.basic(), testCases);
        /**
         * 更新目标数据。执行持久化写入。
         */
        save(draft, draftId);
        /**
         * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toVO(draftId, draft);
    }

    public ProblemDraftVO importZip(String draftId, MultipartFile file, boolean overwrite) {
        return importZip(draftId, file, overwrite, progress -> {});
    }

    public ProblemDraftVO importZip(String draftId, MultipartFile file, boolean overwrite,
                                   Consumer<TestCaseImportProgress> progress) {
        DraftData draft = requireDraft(draftId);
        List<ProblemTestCaseRequest> parsed = parseZip(file, allowsBlankExpectedOutput(draft.basic()), progress);
        int importedCount = parsed.size();
        if (!overwrite) {
            parsed = appendCases(draft.testCases(), parsed);
        }
        validateHiddenTestCases(draft.basic(), parsed);
        draft = new DraftData(draft.basic(), parsed);
        /**
         * 更新目标数据。执行持久化写入。
         */
        progress.accept(new TestCaseImportProgress("savingDraft", importedCount, importedCount, 0));
        save(draft, draftId);
        progress.accept(new TestCaseImportProgress("saved", importedCount, importedCount, 0));
        /**
         * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toVO(draftId, draft);
    }

    public ProblemDraftVO importCommunicationPackage(String draftId, CommunicationPackageReader.Package imported) {
        requireDraft(draftId);
        validateHiddenTestCases(imported.basic(), imported.testCases());
        DraftData draft = new DraftData(imported.basic(), imported.testCases());
        save(draft, draftId);
        return toVO(draftId, draft);
    }

    public ProblemDraftVO detail(String draftId) {
        /**
         * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toVO(draftId, requireDraft(draftId));
    }

    @Transactional
    public ProblemVO commit(String draftId) {
        return commit(draftId, false);
    }

    /** Admin chat may persist an unfinished private problem without inventing test data. */
    @Transactional
    public ProblemVO commit(String draftId, boolean allowIncomplete) {
        AuthUser owner = CurrentUser.required();
        if (allowIncomplete && !owner.isAdmin()) throw new BizException(403, "仅管理员可保存待补充测试数据的题目");
        DraftData draft = requireDraft(draftId);
        if (draft.basic() == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "请先完成题面信息");
        }
        if ((draft.testCases() == null || draft.testCases().isEmpty())
            && !(allowIncomplete && Boolean.FALSE.equals(draft.basic().isPublic()) && "DRAFT".equals(draft.basic().studentPublishStatus()))) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "请先添加测试点");
        }
        Problem problem = new Problem();
        ProblemDraftBasicRequest basic = draft.basic();
        problem.title = basic.title();
        problem.statement = basic.statement();
        problem.inputFormat = basic.inputFormat();
        problem.outputFormat = basic.outputFormat();
        problem.checkerSource = problemService.normalizeCheckerSource(basic.checkerSource());
        problem.communicationConfig = CommunicationConfig.encode(basic.communication());
        problem.sampleCases = "[]";
        problem.timeLimit = basic.timeLimit();
        problem.memoryLimit = basic.memoryLimit();
        problem.difficulty = basic.difficulty() == null ? 1 : Math.max(1, Math.min(5, basic.difficulty()));
        problem.tags = writeJson(basic.tags() == null ? List.of() : basic.tags());
        problem.folderId = basic.folderId();
        problem.ownerId = owner.id();
        problem.ownerAccountType = owner.accountType();
        var scope = resourceAccessService.resolveScope(owner, basic.accessScope(), basic.majorId());
        problem.accessScope = scope.accessScope();
        problem.majorId = scope.majorId();
        String publishStatus = normalizePublishStatus(basic.studentPublishStatus(), basic.isPublic());
        problem.studentPublishStatus = publishStatus;
        problem.isPublic = "PUBLISHED".equals(publishStatus);
        if (problem.isPublic) {
            problem.publishedByAccountType = owner.accountType();
            problem.publishedById = owner.id();
            problem.publishedAt = LocalDateTime.now();
        }
        problem.acRate = BigDecimal.ZERO;
        problemMapper.insert(problem);
        if (problem.folderId != null) {
            problemFolderService.assignOwnedProblem(problem.folderId, problem);
        }

        problemService.replaceTestCases(problem.id, sampleEntities(basic.samples()), true);
        problemService.replaceTestCases(problem.id, hiddenEntities(draft.testCases()), false);
        redisTemplate.delete(key(draftId));
        return problemService.detailAsVO(problem.id);
    }

    private DraftData loadOrNew(String draftId) {
        String value = redisTemplate.opsForValue().get(key(draftId));
        if (value == null) {
            /**
             * 构造 DraftData 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new DraftData(null, List.of());
        }
        /**
         * 读取read并返回给调用方。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return read(value);
    }

    private DraftData requireDraft(String draftId) {
        String value = redisTemplate.opsForValue().get(key(draftId));
        if (value == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(404, "题目草稿不存在或已过期");
        }
        /**
         * 读取read并返回给调用方。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return read(value);
    }

    private void save(DraftData draft, String draftId) {
        redisTemplate.opsForValue().set(key(draftId), writeJson(draft), DRAFT_TTL);
    }

    private String key(String draftId) {
        AuthUser user = CurrentUser.required();
        return RedisKeys.problemDraft(user.accountType(), user.id(), draftId);
    }

    private String normalizePublishStatus(String value, Boolean legacyPublic) {
        String status = value == null
            ? (Boolean.FALSE.equals(legacyPublic) ? "DRAFT" : "PUBLISHED")
            : value.trim().toUpperCase();
        if (!"DRAFT".equals(status) && !"PUBLISHED".equals(status)) {
            throw new BizException(400, "题目发布状态无效");
        }
        return status;
    }

    private DraftData read(String value) {
        try {
            return objectMapper.readValue(value, DraftData.class);
        } catch (Exception ex) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "题目草稿格式错误");
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "题目数据格式错误");
        }
    }

    private ProblemDraftVO toVO(String draftId, DraftData draft) {
        /**
         * 封装题目DraftVO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new ProblemDraftVO(draftId, draft.basic(), draft.testCases() == null ? List.of() : draft.testCases());
    }

    private List<ProblemTestCaseRequest> normalizeCases(List<ProblemTestCaseRequest> testCases) {
        List<ProblemTestCaseRequest> result = new ArrayList<>();
        int index = 1;
        for (ProblemTestCaseRequest item : testCases == null ? List.<ProblemTestCaseRequest>of() : testCases) {
            result.add(new ProblemTestCaseRequest(item.caseNo() == null ? index : item.caseNo(), item.input(), item.output(), item.publicInput()));
            index++;
        }
        return result;
    }

    private boolean allowsBlankExpectedOutput(ProblemDraftBasicRequest basic) {
        return basic != null && (CommunicationConfig.encode(basic.communication()) != null || !ProblemService.requiresExpectedOutput(false, basic.checkerSource()));
    }

    private void validateHiddenTestCases(ProblemDraftBasicRequest basic, List<ProblemTestCaseRequest> testCases) {
        if (allowsBlankExpectedOutput(basic)) {
            return;
        }
        int index = 1;
        for (ProblemTestCaseRequest testCase : testCases == null ? List.<ProblemTestCaseRequest>of() : testCases) {
            int caseNo = testCase.caseNo() == null ? index : testCase.caseNo();
            if (testCase.output() == null) {
                throw new BizException(400, "测试点 " + caseNo + " 的输出字段不能缺失");
            }
            index++;
        }
    }

    private List<ProblemTestCaseRequest> appendCases(
        List<ProblemTestCaseRequest> current,
        List<ProblemTestCaseRequest> imported
    ) {
        List<ProblemTestCaseRequest> result = new ArrayList<>(current == null ? List.of() : current);
        int nextCaseNo = result.stream()
            .map(ProblemTestCaseRequest::caseNo)
            .filter(Objects::nonNull)
            .max(Integer::compareTo)
            .orElse(0) + 1;
        for (ProblemTestCaseRequest item : imported) {
            result.add(new ProblemTestCaseRequest(nextCaseNo++, item.input(), item.output(), item.publicInput()));
        }
        return result;
    }

    private List<ProblemTestCaseRequest> parseZip(MultipartFile file, boolean allowMissingOutput, Consumer<TestCaseImportProgress> progress) {
        TestCaseZipReader.validateUpload(file);
        String filename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        if (!filename.endsWith(".zip")) {
            throw new BizException(400, "测试点必须为 ZIP");
        }
        return TestCaseZipReader.read(file, allowMissingOutput, progress,
            allowMissingOutput ? "ZIP 中未找到测试点" : "ZIP 中未找到 1.in/1.out 格式测试点");
    }

    private List<ProblemTestCase> sampleEntities(List<ProblemSampleCaseRequest> samples) {
        if (samples == null) {
            return List.of();
        }
        List<ProblemTestCase> result = new ArrayList<>();
        int index = 1;
        for (ProblemSampleCaseRequest sample : samples) {
            ProblemTestCase testCase = new ProblemTestCase();
            testCase.caseNo = index++;
            testCase.inputData = sample.input();
            testCase.outputData = sample.output();
            testCase.explanation = sample.explanation();
            result.add(testCase);
        }
        return result;
    }

    private List<ProblemTestCase> hiddenEntities(List<ProblemTestCaseRequest> testCases) {
        List<ProblemTestCase> result = new ArrayList<>();
        for (ProblemTestCaseRequest item : normalizeCases(testCases)) {
            ProblemTestCase testCase = new ProblemTestCase();
            testCase.caseNo = item.caseNo();
            testCase.inputData = item.input();
            testCase.outputData = item.output();
            testCase.publicInput = item.publicInput();
            result.add(testCase);
        }
        return result;
    }

    /**
     * DraftData不可变数据载体。通过 record 语义表达一组只读字段及其结构约束。
     */
    private record DraftData(ProblemDraftBasicRequest basic, List<ProblemTestCaseRequest> testCases) {
    }
}

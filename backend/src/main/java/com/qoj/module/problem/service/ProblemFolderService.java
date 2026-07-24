package com.qoj.module.problem.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.qoj.common.PageResult;
import com.qoj.common.exception.BizException;
import com.qoj.module.problem.dto.ProblemFolderRequest;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.entity.ProblemFolder;
import com.qoj.module.problem.entity.ProblemFolderItem;
import com.qoj.module.problem.entity.ProblemTestCase;
import com.qoj.module.problem.mapper.ProblemFolderItemMapper;
import com.qoj.module.problem.mapper.ProblemFolderMapper;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.mapper.ProblemTestCaseMapper;
import com.qoj.module.problem.vo.ProblemFolderCandidateVO;
import com.qoj.module.problem.vo.ProblemFolderVO;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import com.qoj.security.policy.ResourceAccessService;
import com.qoj.module.teacher.entity.Major;
import com.qoj.module.teacher.mapper.MajorMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 题目文件夹业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class ProblemFolderService {
    private final ProblemFolderMapper folderMapper;
    private final ProblemFolderItemMapper folderItemMapper;
    private final ProblemMapper problemMapper;
    private final ProblemTestCaseMapper testCaseMapper;
    private final ResourceAccessService resourceAccessService;
    private final MajorMapper majorMapper;

    /**
     * 构造 题目文件夹Service 实例并保存其必要依赖或初始状态。从持久化层读取数据。
     */
    public ProblemFolderService(
        ProblemFolderMapper folderMapper,
        ProblemFolderItemMapper folderItemMapper,
        ProblemMapper problemMapper,
        ProblemTestCaseMapper testCaseMapper,
        ResourceAccessService resourceAccessService,
        MajorMapper majorMapper
    ) {
        this.folderMapper = folderMapper;
        this.folderItemMapper = folderItemMapper;
        this.problemMapper = problemMapper;
        this.testCaseMapper = testCaseMapper;
        this.resourceAccessService = resourceAccessService;
        this.majorMapper = majorMapper;
    }

    /**
     * 查询目标数据列表。调用前会结合当前登录身份执行权限判断；从持久化层读取数据。
     */
    public List<ProblemFolderVO> list() {
        AuthUser user = CurrentUser.required();
        QueryWrapper<ProblemFolder> wrapper = new QueryWrapper<ProblemFolder>()
            .orderByAsc("display_order")
            .orderByAsc("id");
        List<ProblemFolder> folders = folderMapper.selectList(wrapper);
        return folders.stream()
            .filter(folder -> resourceAccessService.canAccessFolder(user, folder))
            .map(this::toVO)
            .collect(Collectors.toList());
    }

    /**
     * 封装详情相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public ProblemFolderVO detail(long id) {
        /**
         * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toVO(requireAccessibleFolder(id));
    }

    /**
     * 创建或提交目标数据。调用前会结合当前登录身份执行权限判断；执行持久化写入；结果依赖当前时间。
     */
    public ProblemFolderVO create(ProblemFolderRequest request) {
        AuthUser user = CurrentUser.required();
        ProblemFolder folder = new ProblemFolder();
        folder.name = request.name();
        folder.description = request.description() == null ? "" : request.description();
        folder.displayOrder = request.displayOrder() == null ? 0 : request.displayOrder();
        folder.ownerId = user.id();
        folder.ownerAccountType = user.accountType();
        var scope = resourceAccessService.resolveScope(user, request.accessScope(), request.majorId());
        folder.accessScope = scope.accessScope();
        folder.majorId = scope.majorId();
        folder.createdAt = LocalDateTime.now();
        folder.updatedAt = LocalDateTime.now();
        folderMapper.insert(folder);
        /**
         * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toVO(folder);
    }

    /**
     * 更新目标数据。执行持久化写入；结果依赖当前时间。
     */
    public ProblemFolderVO update(long id, ProblemFolderRequest request) {
        ProblemFolder folder = requireManagedFolder(id);
        folder.name = request.name();
        folder.description = request.description() == null ? "" : request.description();
        folder.displayOrder = request.displayOrder() == null ? folder.displayOrder : request.displayOrder();
        var scope = resourceAccessService.resolveScope(CurrentUser.required(), request.accessScope(), request.majorId());
        folder.accessScope = scope.accessScope();
        folder.majorId = scope.majorId();
        folder.updatedAt = LocalDateTime.now();
        folderMapper.updateById(folder);
        /**
         * 构造或转换VO。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return toVO(folder);
    }

    /**
     * 删除目标数据。不满足业务约束时直接抛出明确异常；执行持久化写入；整个过程位于同一数据库事务中。
     */
    @Transactional
    public void delete(long id) {
        ProblemFolder folder = requireManagedFolder(id);
        long defaultFolderId = getDefaultFolderId();
        if (folder.id == defaultFolderId) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "不能删除默认文件夹");
        }
        List<Problem> legacyItems = problemMapper.selectList(
            new QueryWrapper<Problem>().eq("folder_id", id)
        );
        for (Problem problem : legacyItems) {
            problem.folderId = firstGrantFolder(problem.id, id);
            problemMapper.updateById(problem);
        }
        folderMapper.deleteById(id);
    }

    @Transactional
    public void replaceProblems(long folderId, List<Long> problemIds) {
        requireManagedFolder(folderId);
        AuthUser user = CurrentUser.required();
        List<Long> normalizedIds = problemIds == null ? List.of() : problemIds;
        if (normalizedIds.stream().distinct().count() != normalizedIds.size()) {
            throw new BizException(400, "同一道题不能重复加入文件夹");
        }

        List<Problem> problems = normalizedIds.isEmpty()
            ? List.of()
            : problemMapper.selectBatchIds(normalizedIds);
        Map<Long, Problem> problemById = problems.stream()
            .filter(problem -> !Boolean.TRUE.equals(problem.isDeleted))
            .collect(Collectors.toMap(problem -> problem.id, problem -> problem));
        if (problemById.size() != normalizedIds.size()) {
            throw new BizException(404, "组题中包含不存在或已删除的题目");
        }
        for (Problem problem : problems) {
            if (!resourceAccessService.canUseProblem(user, problem)) {
                throw new BizException(403, "组题中包含无权使用的题目");
            }
        }

        List<ProblemFolderItem> existing = folderItemMapper.selectList(
            new QueryWrapper<ProblemFolderItem>().eq("folder_id", folderId)
        );
        Map<Long, ProblemFolderItem> existingByProblem = existing.stream()
            .collect(Collectors.toMap(item -> item.problemId, item -> item));

        folderItemMapper.delete(new QueryWrapper<ProblemFolderItem>().eq("folder_id", folderId));
        int order = 1;
        for (Long problemId : normalizedIds) {
            Problem problem = problemById.get(problemId);
            ProblemFolderItem previous = existingByProblem.get(problemId);
            ProblemFolderItem item = new ProblemFolderItem();
            item.folderId = folderId;
            item.problemId = problemId;
            item.displayOrder = order++;
            item.relationType = previous == null
                ? relationType(user, problem)
                : previous.relationType;
            item.addedByAccountType = previous == null ? user.accountType() : previous.addedByAccountType;
            item.addedById = previous == null ? user.id() : previous.addedById;
            item.createdAt = previous == null ? LocalDateTime.now() : previous.createdAt;
            folderItemMapper.insert(item);
            if (problem.folderId == null && "GRANT".equals(item.relationType)) {
                problem.folderId = folderId;
                problemMapper.updateById(problem);
            }
        }

        Set<Long> selected = new LinkedHashSet<>(normalizedIds);
        for (ProblemFolderItem removed : existing) {
            if (selected.contains(removed.problemId)) {
                continue;
            }
            Problem problem = problemMapper.selectById(removed.problemId);
            if (problem != null && Long.valueOf(folderId).equals(problem.folderId)) {
                problem.folderId = firstGrantFolder(problem.id, folderId);
                problemMapper.updateById(problem);
            }
        }
    }

    @Transactional
    public void assignOwnedProblem(long folderId, Problem problem) {
        requireManagedFolder(folderId);
        AuthUser user = CurrentUser.required();
        if (problem == null || !isProblemOwner(problem, user) && !resourceAccessService.isSuperAdmin(user)) {
            throw new BizException(403, "只能设置自己创建题目的所属文件夹");
        }
        ProblemFolderItem existing = folderItemMapper.selectOne(
            new QueryWrapper<ProblemFolderItem>()
                .eq("folder_id", folderId)
                .eq("problem_id", problem.id)
                .last("LIMIT 1")
        );
        if (existing == null) {
            Long count = folderItemMapper.selectCount(
                new QueryWrapper<ProblemFolderItem>().eq("folder_id", folderId)
            );
            ProblemFolderItem item = new ProblemFolderItem();
            item.folderId = folderId;
            item.problemId = problem.id;
            item.displayOrder = count.intValue() + 1;
            item.relationType = "GRANT";
            item.addedByAccountType = user.accountType();
            item.addedById = user.id();
            item.createdAt = LocalDateTime.now();
            folderItemMapper.insert(item);
        }
    }

    public PageResult<ProblemFolderCandidateVO> candidates(
        long targetFolderId,
        String source,
        Long sourceFolderId,
        String keyword,
        int page,
        int pageSize
    ) {
        requireManagedFolder(targetFolderId);
        AuthUser user = CurrentUser.required();
        String normalizedSource = source == null ? "ALL" : source.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("ALL", "FOLDER", "MINE", "PUBLIC", "MAJOR", "OUTSIDE").contains(normalizedSource)) {
            throw new BizException(400, "组题来源无效");
        }

        List<ProblemFolder> accessibleFolders = folderMapper.selectList(
            new QueryWrapper<ProblemFolder>().orderByAsc("display_order").orderByAsc("id")
        ).stream().filter(folder -> resourceAccessService.canAccessFolder(user, folder)).toList();
        Map<Long, ProblemFolder> accessibleFolderById = accessibleFolders.stream()
            .collect(Collectors.toMap(folder -> folder.id, folder -> folder));
        if ("FOLDER".equals(normalizedSource)
            && (sourceFolderId == null || !accessibleFolderById.containsKey(sourceFolderId))) {
            throw new BizException(403, "无权访问来源文件夹");
        }

        Map<Long, List<String>> visibleFolderNames = new HashMap<>();
        Set<Long> sourceFolderProblemIds = new LinkedHashSet<>();
        Set<Long> grantedProblemIds = new LinkedHashSet<>();
        if (!accessibleFolderById.isEmpty()) {
            List<ProblemFolderItem> visibleItems = folderItemMapper.selectList(
                new QueryWrapper<ProblemFolderItem>().in("folder_id", accessibleFolderById.keySet())
            );
            for (ProblemFolderItem item : visibleItems) {
                ProblemFolder folder = accessibleFolderById.get(item.folderId);
                visibleFolderNames.computeIfAbsent(item.problemId, ignored -> new ArrayList<>()).add(folder.name);
                if ("GRANT".equals(item.relationType)) {
                    grantedProblemIds.add(item.problemId);
                }
                if (sourceFolderId != null && sourceFolderId.equals(item.folderId)) {
                    sourceFolderProblemIds.add(item.problemId);
                }
            }
        }

        QueryWrapper<Problem> query = new QueryWrapper<Problem>()
            .eq("is_deleted", false)
            .orderByDesc("created_at")
            .orderByDesc("id");
        if (keyword != null && !keyword.isBlank()) {
            String value = keyword.trim();
            query.and(item -> item
                .like("title", value)
                .or().like("tags", value)
                .or().apply("CAST(id AS CHAR) LIKE CONCAT('%', {0}, '%')", value)
            );
        }

        if (!resourceAccessService.isSuperAdmin(user)) {
            Long teacherMajorId = user.teacherAccount() && user.teacher() != null
                ? user.teacher().majorId
                : null;
            query.and(visible -> {
                visible.and(owner -> owner
                    .eq("owner_account_type", user.accountType())
                    .eq("owner_id", user.id())
                ).or().eq("access_scope", "ALL");
                if (teacherMajorId != null) {
                    visible.or(major -> major
                        .eq("access_scope", "MAJOR")
                        .eq("major_id", teacherMajorId)
                    );
                }
                if (!grantedProblemIds.isEmpty()) {
                    visible.or().in("id", grantedProblemIds);
                }
            });
        }

        switch (normalizedSource) {
            case "FOLDER" -> {
                if (sourceFolderProblemIds.isEmpty()) {
                    return new PageResult<>(0, List.of());
                }
                query.in("id", sourceFolderProblemIds);
            }
            case "MINE" -> query
                .eq("owner_account_type", user.accountType())
                .eq("owner_id", user.id());
            case "PUBLIC" -> query.eq("access_scope", "ALL");
            case "MAJOR" -> {
                query.eq("access_scope", "MAJOR");
                if (!resourceAccessService.isSuperAdmin(user)) {
                    Long teacherMajorId = user.teacherAccount() && user.teacher() != null
                        ? user.teacher().majorId
                        : null;
                    if (teacherMajorId == null) {
                        return new PageResult<>(0, List.of());
                    }
                    query.eq("major_id", teacherMajorId);
                }
            }
            case "OUTSIDE" -> {
                if (!visibleFolderNames.isEmpty()) {
                    query.notIn("id", visibleFolderNames.keySet());
                }
            }
            default -> {
            }
        }

        int normalizedPage = Math.max(1, page);
        int normalizedSize = Math.min(Math.max(1, pageSize), 100);
        Page<Problem> resultPage = problemMapper.selectPage(Page.of(normalizedPage, normalizedSize), query);
        List<ProblemFolderCandidateVO> result = resultPage.getRecords().stream()
            .map(problem -> toCandidate(problem, visibleFolderNames.getOrDefault(problem.id, List.of())))
            .toList();
        return new PageResult<>(resultPage.getTotal(), result);
    }

    /**
     * 读取默认值文件夹标识并返回给调用方。执行持久化写入；结果依赖当前时间。
     */
    public long getDefaultFolderId() {
        ProblemFolder folder = folderMapper.selectOne(
            new QueryWrapper<ProblemFolder>().eq("name", "未分类").last("LIMIT 1")
        );
        if (folder != null) return folder.id;
        // 如果不存在则创建
        ProblemFolder newFolder = new ProblemFolder();
        newFolder.name = "未分类";
        newFolder.description = "默认文件夹";
        newFolder.displayOrder = 0;
        newFolder.ownerId = null;
        newFolder.ownerAccountType = "SYSTEM";
        newFolder.accessScope = "PRIVATE";
        newFolder.createdAt = LocalDateTime.now();
        newFolder.updatedAt = LocalDateTime.now();
        folderMapper.insert(newFolder);
        return newFolder.id;
    }

    /**
     * 校验Accessible文件夹。调用前会结合当前登录身份执行权限判断；不满足业务约束时直接抛出明确异常；从持久化层读取数据。
     */
    private ProblemFolder requireAccessibleFolder(long id) {
        ProblemFolder folder = folderMapper.selectById(id);
        if (folder == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(404, "文件夹不存在");
        }
        AuthUser user = CurrentUser.required();
        if (!resourceAccessService.canAccessFolder(user, folder)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(403, "只能访问自己添加的题目文件夹");
        }
        return folder;
    }

    private ProblemFolder requireManagedFolder(long id) {
        ProblemFolder folder = folderMapper.selectById(id);
        if (folder == null) {
            throw new BizException(404, "文件夹不存在");
        }
        AuthUser user = CurrentUser.required();
        if (!resourceAccessService.isSuperAdmin(user)
            && !resourceAccessService.isOwner(user, folder.ownerAccountType, folder.ownerId)) {
            throw new BizException(403, "只能管理自己创建的题目文件夹");
        }
        return folder;
    }

    /**
     * 构造或转换VO。调用前会结合当前登录身份执行权限判断；执行持久化写入。
     */
    private ProblemFolderVO toVO(ProblemFolder folder) {
        AuthUser user = CurrentUser.required();
        List<ProblemFolderItem> items = folderItemMapper.selectList(
            new QueryWrapper<ProblemFolderItem>()
                .eq("folder_id", folder.id)
                .orderByAsc("display_order")
                .orderByAsc("problem_id")
        );
        Map<Long, Problem> problemById = items.isEmpty()
            ? Map.of()
            : problemMapper.selectBatchIds(items.stream().map(item -> item.problemId).toList()).stream()
                .collect(Collectors.toMap(problem -> problem.id, problem -> problem));
        List<Problem> problems = items.stream()
            .map(item -> problemById.get(item.problemId))
            .filter(problem -> problem != null && !Boolean.TRUE.equals(problem.isDeleted))
            .toList();
        problems = problems.stream().filter(problem -> resourceAccessService.canUseProblem(user, problem)).toList();
        List<ProblemFolderVO.FolderProblemVO> problemVOs = problems.stream()
            .map(p -> {
                long testCaseCount = testCaseMapper.selectCount(
                    new QueryWrapper<ProblemTestCase>().eq("problem_id", p.id)
                );
                return new ProblemFolderVO.FolderProblemVO(
                    p.id, p.title, p.difficulty, p.timeLimit, p.memoryLimit, testCaseCount
                );
            })
            .collect(Collectors.toList());
        /**
         * 封装题目文件夹VO相关逻辑。执行持久化写入。
         */
        Major major = folder.majorId == null ? null : majorMapper.selectById(folder.majorId);
        boolean owner = resourceAccessService.isOwner(user, folder.ownerAccountType, folder.ownerId);
        return new ProblemFolderVO(
            folder.id, folder.name, folder.description, folder.displayOrder,
            problems.size(), problemVOs, folder.createdAt, folder.updatedAt,
            folder.ownerAccountType, folder.ownerId, folder.accessScope, folder.majorId,
            major == null ? null : major.name, owner, owner || resourceAccessService.isSuperAdmin(user)
        );
    }

    private boolean isProblemOwner(Problem problem, AuthUser user) {
        return resourceAccessService.isOwner(user, problem.ownerAccountType, problem.ownerId);
    }

    private String relationType(AuthUser user, Problem problem) {
        return resourceAccessService.isSuperAdmin(user) || isProblemOwner(problem, user)
            ? "GRANT"
            : "REFERENCE";
    }

    private Long firstGrantFolder(Long problemId, long excludedFolderId) {
        return folderItemMapper.selectList(
            new QueryWrapper<ProblemFolderItem>()
                .eq("problem_id", problemId)
                .eq("relation_type", "GRANT")
                .ne("folder_id", excludedFolderId)
                .orderByAsc("display_order")
        ).stream().findFirst().map(item -> item.folderId).orElse(null);
    }

    private ProblemFolderCandidateVO toCandidate(Problem problem, List<String> folderNames) {
        Major major = problem.majorId == null ? null : majorMapper.selectById(problem.majorId);
        return new ProblemFolderCandidateVO(
            problem.id,
            problem.title,
            problem.difficulty,
            problem.timeLimit,
            problem.memoryLimit,
            problem.accessScope,
            major == null ? null : major.name,
            folderNames.stream().distinct().toList()
        );
    }

    private String accountType(AuthUser user) {
        return user.accountType();
    }
}

package com.qoj.module.problem.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.common.exception.BizException;
import com.qoj.module.problem.dto.ProblemFolderRequest;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.entity.ProblemFolder;
import com.qoj.module.problem.entity.ProblemTestCase;
import com.qoj.module.problem.mapper.ProblemFolderMapper;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.mapper.ProblemTestCaseMapper;
import com.qoj.module.problem.vo.ProblemFolderVO;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 题目文件夹业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class ProblemFolderService {
    private final ProblemFolderMapper folderMapper;
    private final ProblemMapper problemMapper;
    private final ProblemTestCaseMapper testCaseMapper;

    /**
     * 构造 题目文件夹Service 实例并保存其必要依赖或初始状态。从持久化层读取数据。
     */
    public ProblemFolderService(ProblemFolderMapper folderMapper, ProblemMapper problemMapper, ProblemTestCaseMapper testCaseMapper) {
        this.folderMapper = folderMapper;
        this.problemMapper = problemMapper;
        this.testCaseMapper = testCaseMapper;
    }

    /**
     * 查询目标数据列表。调用前会结合当前登录身份执行权限判断；从持久化层读取数据。
     */
    public List<ProblemFolderVO> list() {
        AuthUser user = CurrentUser.required();
        QueryWrapper<ProblemFolder> wrapper = new QueryWrapper<ProblemFolder>()
            .orderByAsc("display_order")
            .orderByAsc("id");
        if (!"SUPER_ADMIN".equals(user.role())) {
            wrapper.eq("owner_id", user.id());
        }
        List<ProblemFolder> folders = folderMapper.selectList(wrapper);
        return folders.stream().map(this::toVO).collect(Collectors.toList());
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
        ProblemFolder folder = requireAccessibleFolder(id);
        folder.name = request.name();
        folder.description = request.description() == null ? "" : request.description();
        folder.displayOrder = request.displayOrder() == null ? folder.displayOrder : request.displayOrder();
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
        ProblemFolder folder = requireAccessibleFolder(id);
        long defaultFolderId = getDefaultFolderId();
        if (folder.id == defaultFolderId) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "不能删除默认文件夹");
        }
        // 将该文件夹下的题目移到默认文件夹
        Problem update = new Problem();
        update.folderId = defaultFolderId;
        problemMapper.update(update, new QueryWrapper<Problem>()
            .eq("folder_id", id));
        folderMapper.deleteById(id);
    }

    /**
     * 封装moveProblems相关逻辑。调用前会结合当前登录身份执行权限判断；不满足业务约束时直接抛出明确异常；执行持久化写入；整个过程位于同一数据库事务中。
     */
    @Transactional
    public void moveProblems(long folderId, List<Long> problemIds) {
        requireAccessibleFolder(folderId);
        AuthUser user = CurrentUser.required();
        for (Long problemId : problemIds) {
            Problem problem = problemMapper.selectById(problemId);
            if (problem != null) {
                if (!"SUPER_ADMIN".equals(user.role()) && !user.id().equals(problem.ownerId)) {
                    /**
                     * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                     */
                    throw new BizException(403, "只能移动自己创建的题目");
                }
                problem.folderId = folderId;
                problemMapper.updateById(problem);
            }
        }
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
        if (!"SUPER_ADMIN".equals(user.role()) && !user.id().equals(folder.ownerId)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(403, "只能访问自己添加的题目文件夹");
        }
        return folder;
    }

    /**
     * 构造或转换VO。调用前会结合当前登录身份执行权限判断；执行持久化写入。
     */
    private ProblemFolderVO toVO(ProblemFolder folder) {
        AuthUser user = CurrentUser.required();
        QueryWrapper<Problem> wrapper = new QueryWrapper<Problem>()
            .eq("folder_id", folder.id)
            .eq("is_deleted", false)
            .orderByAsc("id");
        if (!"SUPER_ADMIN".equals(user.role())) {
            wrapper.eq("owner_id", user.id());
        }
        List<Problem> problems = problemMapper.selectList(wrapper);
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
        return new ProblemFolderVO(
            folder.id, folder.name, folder.description, folder.displayOrder,
            problems.size(), problemVOs, folder.createdAt, folder.updatedAt
        );
    }
}

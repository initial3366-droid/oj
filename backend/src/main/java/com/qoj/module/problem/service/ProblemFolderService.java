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

@Service
public class ProblemFolderService {
    private final ProblemFolderMapper folderMapper;
    private final ProblemMapper problemMapper;
    private final ProblemTestCaseMapper testCaseMapper;

    public ProblemFolderService(ProblemFolderMapper folderMapper, ProblemMapper problemMapper, ProblemTestCaseMapper testCaseMapper) {
        this.folderMapper = folderMapper;
        this.problemMapper = problemMapper;
        this.testCaseMapper = testCaseMapper;
    }

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

    public ProblemFolderVO detail(long id) {
        return toVO(requireAccessibleFolder(id));
    }

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
        return toVO(folder);
    }

    public ProblemFolderVO update(long id, ProblemFolderRequest request) {
        ProblemFolder folder = requireAccessibleFolder(id);
        folder.name = request.name();
        folder.description = request.description() == null ? "" : request.description();
        folder.displayOrder = request.displayOrder() == null ? folder.displayOrder : request.displayOrder();
        folder.updatedAt = LocalDateTime.now();
        folderMapper.updateById(folder);
        return toVO(folder);
    }

    @Transactional
    public void delete(long id) {
        ProblemFolder folder = requireAccessibleFolder(id);
        long defaultFolderId = getDefaultFolderId();
        if (folder.id == defaultFolderId) {
            throw new BizException(400, "不能删除默认文件夹");
        }
        // 将该文件夹下的题目移到默认文件夹
        Problem update = new Problem();
        update.folderId = defaultFolderId;
        problemMapper.update(update, new QueryWrapper<Problem>()
            .eq("folder_id", id));
        folderMapper.deleteById(id);
    }

    @Transactional
    public void moveProblems(long folderId, List<Long> problemIds) {
        requireAccessibleFolder(folderId);
        AuthUser user = CurrentUser.required();
        for (Long problemId : problemIds) {
            Problem problem = problemMapper.selectById(problemId);
            if (problem != null) {
                if (!"SUPER_ADMIN".equals(user.role()) && !user.id().equals(problem.ownerId)) {
                    throw new BizException(403, "只能移动自己创建的题目");
                }
                problem.folderId = folderId;
                problemMapper.updateById(problem);
            }
        }
    }

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

    private ProblemFolder requireAccessibleFolder(long id) {
        ProblemFolder folder = folderMapper.selectById(id);
        if (folder == null) {
            throw new BizException(404, "文件夹不存在");
        }
        AuthUser user = CurrentUser.required();
        if (!"SUPER_ADMIN".equals(user.role()) && !user.id().equals(folder.ownerId)) {
            throw new BizException(403, "只能访问自己添加的题目文件夹");
        }
        return folder;
    }

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
        return new ProblemFolderVO(
            folder.id, folder.name, folder.description, folder.displayOrder,
            problems.size(), problemVOs, folder.createdAt, folder.updatedAt
        );
    }
}

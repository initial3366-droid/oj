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
        List<ProblemFolder> folders = folderMapper.selectList(
            new QueryWrapper<ProblemFolder>().orderByAsc("display_order").orderByAsc("id")
        );
        return folders.stream().map(this::toVO).collect(Collectors.toList());
    }

    public ProblemFolderVO detail(long id) {
        ProblemFolder folder = folderMapper.selectById(id);
        if (folder == null) {
            throw new BizException(404, "文件夹不存在");
        }
        return toVO(folder);
    }

    public ProblemFolderVO create(ProblemFolderRequest request) {
        ProblemFolder folder = new ProblemFolder();
        folder.name = request.name();
        folder.description = request.description() == null ? "" : request.description();
        folder.displayOrder = request.displayOrder() == null ? 0 : request.displayOrder();
        folder.createdAt = LocalDateTime.now();
        folder.updatedAt = LocalDateTime.now();
        folderMapper.insert(folder);
        return toVO(folder);
    }

    public ProblemFolderVO update(long id, ProblemFolderRequest request) {
        ProblemFolder folder = folderMapper.selectById(id);
        if (folder == null) {
            throw new BizException(404, "文件夹不存在");
        }
        folder.name = request.name();
        folder.description = request.description() == null ? "" : request.description();
        folder.displayOrder = request.displayOrder() == null ? folder.displayOrder : request.displayOrder();
        folder.updatedAt = LocalDateTime.now();
        folderMapper.updateById(folder);
        return toVO(folder);
    }

    @Transactional
    public void delete(long id) {
        long defaultFolderId = getDefaultFolderId();
        if (id == defaultFolderId) {
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
        ProblemFolder folder = folderMapper.selectById(folderId);
        if (folder == null) {
            throw new BizException(404, "文件夹不存在");
        }
        for (Long problemId : problemIds) {
            Problem problem = problemMapper.selectById(problemId);
            if (problem != null) {
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
        newFolder.createdAt = LocalDateTime.now();
        newFolder.updatedAt = LocalDateTime.now();
        folderMapper.insert(newFolder);
        return newFolder.id;
    }

    private ProblemFolderVO toVO(ProblemFolder folder) {
        List<Problem> problems = problemMapper.selectList(
            new QueryWrapper<Problem>()
                .eq("folder_id", folder.id)
                .eq("is_deleted", false)
                .orderByAsc("id")
        );
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

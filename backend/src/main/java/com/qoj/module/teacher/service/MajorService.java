package com.qoj.module.teacher.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.common.exception.BizException;
import com.qoj.module.teacher.dto.MajorRequest;
import com.qoj.module.teacher.entity.Major;
import com.qoj.module.teacher.entity.Teacher;
import com.qoj.module.teacher.mapper.MajorMapper;
import com.qoj.module.teacher.mapper.TeacherMapper;
import com.qoj.module.teacher.vo.MajorVO;
import com.qoj.module.practice.entity.Practice;
import com.qoj.module.practice.mapper.PracticeMapper;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.entity.ProblemFolder;
import com.qoj.module.problem.mapper.ProblemFolderMapper;
import com.qoj.module.problem.mapper.ProblemMapper;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MajorService {
    private final MajorMapper majorMapper;
    private final TeacherMapper teacherMapper;
    private final ProblemFolderMapper problemFolderMapper;
    private final ProblemMapper problemMapper;
    private final PracticeMapper practiceMapper;

    public MajorService(
        MajorMapper majorMapper,
        TeacherMapper teacherMapper,
        ProblemFolderMapper problemFolderMapper,
        ProblemMapper problemMapper,
        PracticeMapper practiceMapper
    ) {
        this.majorMapper = majorMapper;
        this.teacherMapper = teacherMapper;
        this.problemFolderMapper = problemFolderMapper;
        this.problemMapper = problemMapper;
        this.practiceMapper = practiceMapper;
    }

    public List<MajorVO> list(String keyword, boolean activeOnly) {
        QueryWrapper<Major> wrapper = new QueryWrapper<>();
        if (activeOnly) {
            wrapper.eq("status", "ACTIVE");
        }
        if (keyword != null && !keyword.isBlank()) {
            String value = keyword.trim();
            wrapper.and(item -> item.like("code", value).or().like("name", value));
        }
        wrapper.orderByAsc("name").orderByAsc("id");
        return majorMapper.selectList(wrapper).stream().map(this::toVO).toList();
    }

    @Transactional
    public MajorVO create(MajorRequest request) {
        ensureUnique(request.code(), request.name(), null);
        Major major = new Major();
        apply(major, request);
        majorMapper.insert(major);
        return toVO(majorMapper.selectById(major.id));
    }

    @Transactional
    public MajorVO update(long id, MajorRequest request) {
        Major major = requireMajor(id);
        ensureUnique(request.code(), request.name(), id);
        apply(major, request);
        majorMapper.updateById(major);
        return toVO(majorMapper.selectById(id));
    }

    @Transactional
    public void delete(long id) {
        requireMajor(id);
        if (teacherMapper.selectCount(new QueryWrapper<Teacher>().eq("major_id", id)) > 0) {
            throw new BizException(400, "该专业仍有关联教师，请先转移教师或停用专业");
        }
        if (problemFolderMapper.selectCount(new QueryWrapper<ProblemFolder>().eq("major_id", id)) > 0
            || problemMapper.selectCount(new QueryWrapper<Problem>().eq("major_id", id)) > 0
            || practiceMapper.selectCount(new QueryWrapper<Practice>().eq("major_id", id)) > 0) {
            throw new BizException(400, "该专业仍被题目文件夹、题目或题单使用，请改为停用专业");
        }
        majorMapper.deleteById(id);
    }

    private Major requireMajor(long id) {
        Major major = majorMapper.selectById(id);
        if (major == null) {
            throw new BizException(404, "专业不存在");
        }
        return major;
    }

    private void apply(Major major, MajorRequest request) {
        major.code = request.code().trim();
        major.name = request.name().trim();
        String status = request.status() == null ? "ACTIVE" : request.status().trim().toUpperCase();
        if (!Set.of("ACTIVE", "DISABLED").contains(status)) {
            throw new BizException(400, "专业状态无效");
        }
        major.status = status;
    }

    private void ensureUnique(String code, String name, Long currentId) {
        QueryWrapper<Major> wrapper = new QueryWrapper<Major>()
            .and(item -> item.eq("code", code.trim()).or().eq("name", name.trim()));
        if (currentId != null) {
            wrapper.ne("id", currentId);
        }
        if (majorMapper.selectCount(wrapper) > 0) {
            throw new BizException(400, "专业编码或名称已存在");
        }
    }

    private MajorVO toVO(Major major) {
        Long count = teacherMapper.selectCount(new QueryWrapper<Teacher>().eq("major_id", major.id));
        return new MajorVO(
            major.id, major.code, major.name, major.status, count, major.createdAt, major.updatedAt
        );
    }
}

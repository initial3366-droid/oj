package com.qoj.security.policy;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.common.enums.AccessScope;
import com.qoj.common.exception.BizException;
import com.qoj.module.practice.entity.Practice;
import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.entity.ProblemFolder;
import com.qoj.module.problem.entity.ProblemFolderItem;
import com.qoj.module.problem.mapper.ProblemFolderItemMapper;
import com.qoj.module.problem.mapper.ProblemFolderMapper;
import com.qoj.module.teacher.entity.Major;
import com.qoj.module.teacher.entity.Teacher;
import com.qoj.module.teacher.mapper.MajorMapper;
import com.qoj.module.teacher.mapper.TeacherMapper;
import com.qoj.security.AuthUser;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ResourceAccessService {
    private final TeacherMapper teacherMapper;
    private final MajorMapper majorMapper;
    private final ProblemFolderMapper folderMapper;
    private final ProblemFolderItemMapper folderItemMapper;

    public ResourceAccessService(
        TeacherMapper teacherMapper,
        MajorMapper majorMapper,
        ProblemFolderMapper folderMapper,
        ProblemFolderItemMapper folderItemMapper
    ) {
        this.teacherMapper = teacherMapper;
        this.majorMapper = majorMapper;
        this.folderMapper = folderMapper;
        this.folderItemMapper = folderItemMapper;
    }

    public boolean isSuperAdmin(AuthUser user) {
        return user != null && user.adminAccount() && "SUPER_ADMIN".equals(user.role());
    }

    public boolean isOwner(AuthUser user, String ownerAccountType, Long ownerId) {
        return user != null
            && ownerId != null
            && ownerId.equals(user.id())
            && user.accountType().equals(normalizeOwnerType(ownerAccountType));
    }

    public boolean canAccessScope(AuthUser user, String scopeValue, Long majorId) {
        if (isSuperAdmin(user)) {
            return true;
        }
        if (user == null || !user.teacherAccount()) {
            return false;
        }
        AccessScope scope = normalizeScope(scopeValue);
        if (scope == AccessScope.ALL) {
            return true;
        }
        if (scope != AccessScope.MAJOR || majorId == null) {
            return false;
        }
        Teacher teacher = teacherMapper.selectById(user.id());
        return teacher != null && "ACTIVE".equals(teacher.status) && majorId.equals(teacher.majorId);
    }

    public boolean canAccessFolder(AuthUser user, ProblemFolder folder) {
        return folder != null && (
            isSuperAdmin(user)
                || isOwner(user, folder.ownerAccountType, folder.ownerId)
                || canAccessScope(user, folder.accessScope, folder.majorId)
        );
    }

    public boolean canUseProblem(AuthUser user, Problem problem) {
        if (problem == null) {
            return false;
        }
        if (isSuperAdmin(user)
            || isOwner(user, problem.ownerAccountType, problem.ownerId)
            || canAccessScope(user, problem.accessScope, problem.majorId)) {
            return true;
        }
        List<ProblemFolderItem> grants = folderItemMapper.selectList(
            new QueryWrapper<ProblemFolderItem>()
                .eq("problem_id", problem.id)
                .eq("relation_type", "GRANT")
        );
        for (ProblemFolderItem grant : grants) {
            if (canAccessFolder(user, folderMapper.selectById(grant.folderId))) {
                return true;
            }
        }
        return false;
    }

    public boolean canAccessPractice(AuthUser user, Practice practice) {
        return practice != null && (
            isSuperAdmin(user)
                || isOwner(user, practice.ownerAccountType, practice.ownerId)
                || canAccessScope(user, practice.accessScope, practice.majorId)
        );
    }

    public ScopeSelection resolveScope(AuthUser user, String requestedScope, Long requestedMajorId) {
        AccessScope scope = normalizeScope(requestedScope == null ? AccessScope.ALL.name() : requestedScope);
        Long majorId = requestedMajorId;
        if (user.teacherAccount()) {
            Teacher teacher = teacherMapper.selectById(user.id());
            if (teacher == null || !"ACTIVE".equals(teacher.status)) {
                throw new BizException(403, "教师账号不存在或已停用");
            }
            majorId = teacher.majorId;
        }
        if (scope == AccessScope.MAJOR) {
            if (majorId == null) {
                throw new BizException(400, "本专业权限必须设置专业");
            }
            Major major = majorMapper.selectById(majorId);
            if (major == null || !"ACTIVE".equals(major.status)) {
                throw new BizException(400, "专业不存在或已停用");
            }
        }
        return new ScopeSelection(scope.name(), majorId);
    }

    public AccessScope normalizeScope(String value) {
        try {
            return AccessScope.valueOf(value == null ? "PRIVATE" : value.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BizException(400, "开放权限仅支持所有人、本专业或私有");
        }
    }

    public String normalizeOwnerType(String value) {
        return switch (value == null ? "UNKNOWN" : value.trim().toUpperCase()) {
            case "ADMIN" -> "ADMIN";
            case "TEACHER" -> "TEACHER";
            case "USER" -> "USER";
            case "SYSTEM" -> "SYSTEM";
            default -> "UNKNOWN";
        };
    }

    public record ScopeSelection(String accessScope, Long majorId) {
    }
}

package com.qoj.module.user.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.qoj.common.exception.BizException;
import com.qoj.module.agent.service.AgentChatService;
import com.qoj.module.classroom.entity.ClassJoinApplication;
import com.qoj.module.classroom.entity.ClassMember;
import com.qoj.module.classroom.entity.ClassRoom;
import com.qoj.module.classroom.mapper.ClassJoinApplicationMapper;
import com.qoj.module.classroom.mapper.ClassMemberMapper;
import com.qoj.module.classroom.mapper.ClassRoomMapper;
import com.qoj.module.user.dto.StudentBatchRequest;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.security.AuthUser;
import com.qoj.security.CurrentUser;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminStudentBatchService {
    private final UserMapper users;
    private final ClassRoomMapper classes;
    private final ClassMemberMapper members;
    private final ClassJoinApplicationMapper applications;
    private final UserAdminService userAdminService;
    private final AgentChatService agent;
    private final PasswordEncoder passwords;

    public AdminStudentBatchService(UserMapper users, ClassRoomMapper classes, ClassMemberMapper members,
        ClassJoinApplicationMapper applications, UserAdminService userAdminService,
        AgentChatService agent, PasswordEncoder passwords) {
        this.users = users;
        this.classes = classes;
        this.members = members;
        this.applications = applications;
        this.userAdminService = userAdminService;
        this.agent = agent;
        this.passwords = passwords;
    }

    public record Result(String action, int affectedCount) {}

    @Transactional
    public Result execute(StudentBatchRequest request) {
        AuthUser actor = CurrentUser.required();
        if (!actor.isAdmin() && !actor.teacherAccount()) throw new BizException(403, "无学生管理权限");
        String action = request.action();
        if (!Set.of("ASSIGN_CLASS", "REMOVE_CLASS", "RESET_PASSWORD", "RESET_AI_QUOTA", "DELETE").contains(action)) {
            throw new BizException(400, "不支持的批量操作");
        }
        List<Long> ids = request.userIds().stream().distinct().sorted().toList();
        if (ids.isEmpty() || ids.size() > 500) throw new BizException(400, "请选择 1 至 500 名学生");
        if ("ASSIGN_CLASS".equals(action)
            && (request.classId() == null || classes.selectById(request.classId()) == null)) {
            throw new BizException(400, "请选择有效的目标班级");
        }
        if ("RESET_PASSWORD".equals(action)
            && (request.password() == null || request.password().trim().length() < 6
                || request.password().trim().getBytes(StandardCharsets.UTF_8).length > 72)) {
            throw new BizException(400, "新密码至少 6 个字符，最多 72 字节");
        }
        // All users are validated and locked before any mutation, using the same locks as admission.
        List<User> selected = users.selectList(new QueryWrapper<User>().in("id", ids).orderByAsc("id").last("FOR UPDATE"));
        if (selected.size() != ids.size()) throw new BizException(400, "部分学生已不存在，请刷新后重试");
        if (selected.stream().anyMatch(user -> !"STUDENT".equals(user.role))) {
            throw new BizException(400, "批量操作仅支持学生账号");
        }
        if (actor.teacherAccount()) {
            List<ClassMember> current = members.selectList(new QueryWrapper<ClassMember>()
                .in("user_id", ids).orderByAsc("user_id").last("FOR UPDATE"));
            if (current.size() != ids.size()) throw new BizException(403, "只能管理自己班级的学生");
            Set<Long> classIds = new TreeSet<>();
            current.forEach(member -> classIds.add(member.classId));
            if ("ASSIGN_CLASS".equals(action)) classIds.add(request.classId());
            var scopedClasses = classes.selectList(new QueryWrapper<ClassRoom>()
                .in("id", classIds).orderByAsc("id").last("FOR SHARE"));
            if (scopedClasses.size() != classIds.size()
                || scopedClasses.stream().anyMatch(room -> !actor.id().equals(room.teacherId))) {
                throw new BizException(403, "只能管理自己班级的学生，目标班级也必须属于自己");
            }
        }
        switch (action) {
            case "ASSIGN_CLASS", "REMOVE_CLASS" -> {
                Long target = "ASSIGN_CLASS".equals(action) ? request.classId() : null;
                for (User user : selected) {
                    ClassMember current = members.selectOne(new QueryWrapper<ClassMember>().eq("user_id", user.id).last("FOR UPDATE"));
                    if (target == null || current == null || !target.equals(current.classId)) {
                        members.delete(new QueryWrapper<ClassMember>().eq("user_id", user.id));
                        if (target != null) {
                            ClassMember member = new ClassMember();
                            member.classId = target;
                            member.userId = user.id;
                            member.source = actor.teacherAccount() ? "TEACHER" : "ADMIN";
                            member.joinedAt = LocalDateTime.now();
                            members.insert(member);
                        }
                    }
                    users.update(null, new UpdateWrapper<User>().eq("id", user.id).set("class_id", target));
                }
                // Pending admissions must not silently re-add a student to the old class later.
                applications.update(null, new UpdateWrapper<ClassJoinApplication>().in("user_id", ids)
                    .eq("status", "PENDING").set("status", "REJECTED")
                    .set("reason", actor.teacherAccount() ? "教师已调整学生班级" : "管理员已调整学生班级").set("handled_at", LocalDateTime.now())
                    .set("handled_by", CurrentUser.id()).set("handled_by_account_type", CurrentUser.required().accountType()));
            }
            case "RESET_PASSWORD" -> {
                for (User user : selected) users.update(null, new UpdateWrapper<User>().eq("id", user.id)
                    .set("password_hash", passwords.encode(request.password().trim())));
            }
            case "RESET_AI_QUOTA" -> agent.resetQuotas(ids);
            case "DELETE" -> {
                try {
                    for (Long id : ids) userAdminService.delete(id);
                } catch (DataIntegrityViolationException error) {
                    throw new BizException(400, "部分学生仍有关联数据，整批删除已取消，请处理关联后重试");
                }
            }
            default -> throw new BizException(400, "不支持的批量操作");
        }
        return new Result(action, ids.size());
    }
}

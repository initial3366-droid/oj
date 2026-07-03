package com.qoj.module.user.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.qoj.common.PageResult;
import com.qoj.common.enums.UserRole;
import com.qoj.common.exception.BizException;
import com.qoj.module.user.dto.UserCreateRequest;
import com.qoj.module.user.dto.UserUpdateRequest;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.entity.UserScore;
import com.qoj.module.user.mapper.AdminUserMapper;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.user.mapper.UserScoreMapper;
import com.qoj.module.user.vo.UserVO;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserAdminService {
    private final UserMapper userMapper;
    private final AdminUserMapper adminUserMapper;
    private final UserScoreMapper userScoreMapper;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;

    public UserAdminService(
        UserMapper userMapper,
        AdminUserMapper adminUserMapper,
        UserScoreMapper userScoreMapper,
        PasswordEncoder passwordEncoder,
        JdbcTemplate jdbcTemplate
    ) {
        this.userMapper = userMapper;
        this.adminUserMapper = adminUserMapper;
        this.userScoreMapper = userScoreMapper;
        this.passwordEncoder = passwordEncoder;
        this.jdbcTemplate = jdbcTemplate;
    }

    public PageResult<UserVO> list(int page, int pageSize, String role, String keyword) {
        QueryWrapper<User> wrapper = new QueryWrapper<>();
        if (role != null && !role.isBlank()) {
            wrapper.eq("role", role);
        } else {
            wrapper.in("role", activeFrontendRoles());
        }
        if (keyword != null && !keyword.isBlank()) {
            wrapper.and(item -> item
                .like("username", keyword)
                .or()
                .like("display_name", keyword)
                .or()
                .like("student_no", keyword)
                .or()
                .like("email", keyword)
            );
        }
        wrapper.orderByDesc("created_at");
        Page<User> result = userMapper.selectPage(Page.of(page, pageSize), wrapper);
        List<User> records = result.getRecords();

        Map<Long, String> classNameMap = batchQueryClassNames(records);

        return new PageResult<>(result.getTotal(),
            records.stream().map(u -> toVO(u, classNameMap.getOrDefault(u.id, null))).toList());
    }

    private Map<Long, String> batchQueryClassNames(List<User> users) {
        if (users.isEmpty()) return Collections.emptyMap();
        List<Long> userIds = users.stream().map(u -> u.id).toList();
        String placeholders = String.join(",", Collections.nCopies(userIds.size(), "?"));
        String sql = "SELECT cm.user_id, c.name FROM class_members cm "
            + "JOIN classes c ON cm.class_id = c.id "
            + "WHERE cm.user_id IN (" + placeholders + ")";
        Map<Long, String> map = new HashMap<>();
        jdbcTemplate.query(sql, userIds.toArray(), rs -> {
            map.putIfAbsent(rs.getLong("user_id"), rs.getString("name"));
        });
        return map;
    }

    @Transactional
    public UserVO create(UserCreateRequest request) {
        validateUserRole(request.role().name());
        ensureUnique(request.username(), request.studentNo(), request.email(), null);
        User user = new User();
        user.username = request.username();
        user.passwordHash = passwordEncoder.encode(request.password());
        user.displayName = request.displayName();
        user.studentNo = blankToNull(request.studentNo());
        user.email = blankToNull(request.email());
        user.role = request.role().name();
        userMapper.insert(user);
        ensureScore(user.id);
        return toVO(user, null);
    }

    @Transactional
    public UserVO update(long id, UserUpdateRequest request) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BizException(404, "用户不存在");
        }
        ensureUnique(request.username(), request.studentNo(), request.email(), id);
        if (request.username() != null && !request.username().isBlank()) {
            user.username = request.username();
        }
        if (request.password() != null && !request.password().isBlank()) {
            user.passwordHash = passwordEncoder.encode(request.password());
        }
        if (request.displayName() != null) {
            user.displayName = request.displayName();
        }
        if (request.studentNo() != null) {
            user.studentNo = blankToNull(request.studentNo());
        }
        if (request.email() != null) {
            user.email = blankToNull(request.email());
        }
        if (request.role() != null) {
            validateUserRole(request.role().name());
            user.role = request.role().name();
        }
        userMapper.updateById(user);
        ensureScore(user.id);
        return toVO(user, null);
    }

    @Transactional
    public void delete(long id) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BizException(404, "用户不存在");
        }

        // Delete related records first
        userScoreMapper.deleteById(id);

        // Delete the user
        userMapper.deleteById(id);
    }

    public UserVO toVO(User user, String className) {
        return new UserVO(
            user.id,
            user.username,
            user.displayName,
            user.studentNo,
            user.email,
            user.role,
            className,
            user.createdAt,
            user.updatedAt
        );
    }

    private void ensureUnique(String username, String studentNo, String email, Long currentUserId) {
        if (username != null && exists("username", username, currentUserId)) {
            throw new BizException(400, "用户名已存在");
        }
        if (studentNo != null && !studentNo.isBlank() && exists("student_no", studentNo, currentUserId)) {
            throw new BizException(400, "学号已存在");
        }
        if (email != null && !email.isBlank() && exists("email", email, currentUserId)) {
            throw new BizException(400, "邮箱已存在");
        }
    }

    private boolean exists(String column, String value, Long currentUserId) {
        QueryWrapper<User> wrapper = new QueryWrapper<User>().eq(column, value);
        if (currentUserId != null) {
            wrapper.ne("id", currentUserId);
        }
        boolean existsInUsers = userMapper.selectCount(wrapper) > 0;
        boolean existsInAdmins = ("username".equals(column) || "email".equals(column))
            && adminUserMapper.selectCount(new QueryWrapper<AdminUser>().eq(column, value)) > 0;
        return existsInUsers || existsInAdmins;
    }

    private void ensureScore(Long userId) {
        if (userScoreMapper.selectById(userId) != null) {
            return;
        }
        UserScore score = new UserScore();
        score.userId = userId;
        score.totalScore = 0;
        score.rating = 0;
        score.acCount = 0;
        score.submitCount = 0;
        score.streak = 0;
        userScoreMapper.insert(score);
    }

    private void validateUserRole(String role) {
        if ("SUPER_ADMIN".equals(role)) {
            throw new BizException(400, "系统管理员不属于前台用户表");
        }
        if (!UserRole.isActiveFrontendRole(role)) {
            throw new BizException(400, "用户角色不可用");
        }
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private List<String> activeFrontendRoles() {
        return List.of(
            UserRole.STUDENT.name(),
            UserRole.TEACHER.name(),
            UserRole.GUEST.name()
        );
    }
}

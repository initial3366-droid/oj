package com.qoj.security;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.qoj.common.enums.UserRole;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.UserMapper;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/**
 * Spring Security 用户信息加载服务。
 *
 * 从 users 表按用户名查询，验证角色是否为前台合法角色（排除后台管理员），
 * 返回包装后的 AuthUser 供 Spring Security 认证流程使用。
 *
 * 注意：此服务仅加载前台用户（users 表），后台管理员由 AdminAuthController 单独处理。
 */
@Service
public class DbUserDetailsService implements UserDetailsService {
    private final UserMapper userMapper;

    public DbUserDetailsService(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    /**
     * 按用户名加载用户信息。
     * @throws UsernameNotFoundException 用户不存在或角色不合法时抛出
     */
    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userMapper.selectOne(new QueryWrapper<User>().eq("username", username));
        if (user == null) {
            throw new UsernameNotFoundException(username);
        }
        // 过滤掉后台角色（SUPER_ADMIN/TEACHER），仅前台学生/GUEST 可通过此服务登录
        if (!UserRole.isActiveFrontendRole(user.role)) {
            throw new UsernameNotFoundException(username);
        }
        return new AuthUser(user);
    }
}

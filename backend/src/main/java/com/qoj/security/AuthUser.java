package com.qoj.security;

import com.qoj.common.exception.BizException;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.entity.User;
import java.util.Collection;
import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

/**
 * 认证用户领域类型。封装 qoj.security 模块内的相关职责。
 */
public class AuthUser implements UserDetails {
    private final User user;
    private final AdminUser adminUser;
    private final Long id;
    private final String username;
    private final String passwordHash;
    private final String role;
    private final String displayName;
    private final boolean adminAccount;

    /**
     * 构造 认证用户 实例并保存其必要依赖或初始状态。调用前会结合当前登录身份执行权限判断。
     */
    public AuthUser(User user) {
        this.user = user;
        this.adminUser = null;
        this.id = user.id;
        this.username = user.username;
        this.passwordHash = user.passwordHash;
        this.role = user.role;
        this.displayName = user.displayName;
        this.adminAccount = false;
    }

    /**
     * 构造 认证用户 实例并保存其必要依赖或初始状态。调用前会结合当前登录身份执行权限判断。
     */
    public AuthUser(AdminUser adminUser) {
        this.user = null;
        this.adminUser = adminUser;
        this.id = adminUser.id;
        this.username = adminUser.username;
        this.passwordHash = adminUser.passwordHash;
        this.role = adminUser.role;
        this.displayName = adminUser.displayName;
        this.adminAccount = true;
    }

    /**
     * 封装标识相关逻辑。直接返回当前实例保存的标识，不产生额外的数据写入。
     */
    public Long id() {
        return id;
    }

    /**
     * 封装角色相关逻辑。直接返回当前实例保存的角色，不产生额外的数据写入。
     */
    public String role() {
        return role;
    }

    /**
     * 封装display名称相关逻辑。直接返回当前实例保存的display名称，不产生额外的数据写入。
     */
    public String displayName() {
        return displayName;
    }

    /**
     * 封装r相关逻辑。不满足业务约束时直接抛出明确异常。
     */
    public User user() {
        if (user == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(403, "后台账号不能作为前台用户使用");
        }
        return user;
    }

    /**
     * 封装管理员用户相关逻辑。直接返回当前实例保存的管理员用户，不产生额外的数据写入。
     */
    public AdminUser adminUser() {
        return adminUser;
    }

    /**
     * 封装管理员Account相关逻辑。直接返回当前实例保存的管理员Account，不产生额外的数据写入。
     */
    public boolean adminAccount() {
        return adminAccount;
    }

    /**
     * 检查是否是管理员（SUPER_ADMIN）
     */
    public boolean isAdmin() {
        return adminAccount && "SUPER_ADMIN".equals(role);
    }

    /**
     * 读取Authorities并返回给调用方。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role));
    }

    /**
     * 读取Password并返回给调用方。直接返回当前实例保存的passwordHash，不产生额外的数据写入。
     */
    @Override
    public String getPassword() {
        return passwordHash;
    }

    /**
     * 读取Username并返回给调用方。直接返回当前实例保存的username，不产生额外的数据写入。
     */
    @Override
    public String getUsername() {
        return username;
    }
}

package com.qoj.security;

import com.qoj.common.exception.BizException;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.entity.User;
import java.util.Collection;
import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public class AuthUser implements UserDetails {
    private final User user;
    private final AdminUser adminUser;
    private final Long id;
    private final String username;
    private final String passwordHash;
    private final String role;
    private final String displayName;
    private final boolean adminAccount;

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

    public Long id() {
        return id;
    }

    public String role() {
        return role;
    }

    public String displayName() {
        return displayName;
    }

    public User user() {
        if (user == null) {
            throw new BizException(403, "后台账号不能作为前台用户使用");
        }
        return user;
    }

    public AdminUser adminUser() {
        return adminUser;
    }

    public boolean adminAccount() {
        return adminAccount;
    }

    /**
     * 检查是否是管理员（SUPER_ADMIN）
     */
    public boolean isAdmin() {
        return adminAccount && "SUPER_ADMIN".equals(role);
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return username;
    }
}

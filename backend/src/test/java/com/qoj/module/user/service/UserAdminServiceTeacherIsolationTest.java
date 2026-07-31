package com.qoj.module.user.service;

import com.qoj.common.exception.BizException;
import com.qoj.module.user.mapper.AdminUserMapper;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.user.mapper.UserScoreMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class UserAdminServiceTeacherIsolationTest {
    @Mock private UserMapper userMapper;
    @Mock private AdminUserMapper adminUserMapper;
    @Mock private UserScoreMapper userScoreMapper;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JdbcTemplate jdbcTemplate;
    @InjectMocks private UserAdminService userAdminService;

    @Test
    void teacherRoleCannotBeQueriedThroughUsersEndpoint() {
        assertThrows(BizException.class, () -> userAdminService.list(1, 20, "TEACHER", null));

        verifyNoInteractions(userMapper);
    }
}

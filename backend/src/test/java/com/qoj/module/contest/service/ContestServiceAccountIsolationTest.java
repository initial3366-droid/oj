package com.qoj.module.contest.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.qoj.common.exception.BizException;
import com.qoj.module.classroom.mapper.ClassMemberMapper;
import com.qoj.module.contest.dto.ContestRegisterRequest;
import com.qoj.module.contest.entity.Contest;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.teacher.entity.Teacher;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.security.AuthUser;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContestServiceAccountIsolationTest {
    @Mock private ContestMapper contestMapper;
    @Mock private UserMapper userMapper;
    @Mock private ClassMemberMapper classMemberMapper;
    @InjectMocks private ContestService contestService;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void teacherListDoesNotQueryStudentIdentityTables() {
        authenticateTeacher(7L);
        Page<Contest> result = Page.of(1, 20);
        result.setRecords(List.of());
        result.setTotal(0);
        when(contestMapper.selectPage(any(Page.class), any(QueryWrapper.class))).thenReturn(result);

        contestService.list(1, 20);

        verify(userMapper, never()).selectById(any());
        verify(classMemberMapper, never()).selectList(any());
    }

    @Test
    void teacherCannotUseStudentRegistrationEndpoints() {
        authenticateTeacher(7L);
        Contest contest = new Contest();
        contest.id = 1L;
        when(contestMapper.selectById(1L)).thenReturn(contest);

        assertThrows(BizException.class, () -> contestService.register(1L, new ContestRegisterRequest(null, null, false, null)));
        assertThrows(BizException.class, () -> contestService.registrationOptions(1L));

        verify(userMapper, never()).selectById(any());
        verify(classMemberMapper, never()).selectList(any());
    }

    @Test
    void studentCannotRegisterAfterContestEnd() {
        authenticateStudent(8L);
        Contest contest = new Contest();
        contest.id = 1L;
        contest.endTime = LocalDateTime.now().minusMinutes(1);
        when(contestMapper.selectById(1L)).thenReturn(contest);

        BizException exception = assertThrows(
            BizException.class,
            () -> contestService.register(1L, new ContestRegisterRequest(null, null, false, null))
        );

        assertEquals(403, exception.getCode());
        assertEquals("比赛已结束，报名已截止", exception.getMessage());
        verify(userMapper, never()).selectById(any());
    }

    private void authenticateTeacher(Long id) {
        Teacher teacher = new Teacher();
        teacher.id = id;
        teacher.username = "teacher" + id;
        teacher.displayName = "Teacher " + id;
        teacher.passwordHash = "hash";
        teacher.status = "ACTIVE";
        AuthUser principal = new AuthUser(teacher);
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities())
        );
    }

    private void authenticateStudent(Long id) {
        User user = new User();
        user.id = id;
        user.username = "student" + id;
        user.displayName = "Student " + id;
        user.passwordHash = "hash";
        user.role = "STUDENT";
        AuthUser principal = new AuthUser(user);
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities())
        );
    }
}

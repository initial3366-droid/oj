package com.qoj.module.classroom.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.ErrorCode;
import com.qoj.common.exception.BizException;
import com.qoj.module.classroom.dto.UpdateStudentRequest;
import com.qoj.module.classroom.entity.ClassMember;
import com.qoj.module.classroom.entity.ClassRoom;
import com.qoj.module.classroom.mapper.ClassJoinApplicationMapper;
import com.qoj.module.classroom.mapper.ClassMemberMapper;
import com.qoj.module.classroom.mapper.ClassRoomMapper;
import com.qoj.module.contest.mapper.ContestAudienceMapper;
import com.qoj.module.contest.mapper.ContestMapper;
import com.qoj.module.practice.mapper.PracticeMapper;
import com.qoj.module.teacher.entity.Teacher;
import com.qoj.module.teacher.mapper.MajorMapper;
import com.qoj.module.teacher.mapper.TeacherMapper;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.AdminUserMapper;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.user.mapper.UserScoreMapper;
import com.qoj.security.AuthUser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClassRoomServiceTeacherStudentUpdateTest {
    @Mock private ClassRoomMapper classRoomMapper;
    @Mock private ClassMemberMapper classMemberMapper;
    @Mock private ClassJoinApplicationMapper applicationMapper;
    @Mock private UserMapper userMapper;
    @Mock private TeacherMapper teacherMapper;
    @Mock private MajorMapper majorMapper;
    @Mock private UserScoreMapper userScoreMapper;
    @Mock private AdminUserMapper adminUserMapper;
    @Mock private ContestMapper contestMapper;
    @Mock private ContestAudienceMapper contestAudienceMapper;
    @Mock private PracticeMapper practiceMapper;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private ObjectMapper objectMapper;
    @InjectMocks private ClassRoomService classRoomService;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void teacherCannotUpdateStudentOutsideManagedClass() {
        authenticateTeacher(10L);
        User student = student(20L, 200L, "old-hash");
        ClassRoom otherTeachersClass = classRoom(200L, 99L);
        when(userMapper.selectById(20L)).thenReturn(student);
        when(classRoomMapper.selectById(200L)).thenReturn(otherTeachersClass);

        BizException exception = assertThrows(
            BizException.class,
            () -> classRoomService.teacherUpdateStudent(20L, new UpdateStudentRequest("Updated", null, null, null))
        );

        assertEquals(ErrorCode.FORBIDDEN.getCode(), exception.getCode());
        verify(userMapper, never()).updateById(any(User.class));
        verify(passwordEncoder, never()).encode(any());
    }

    @Test
    void blankPasswordKeepsExistingHash() {
        authenticateTeacher(10L);
        User student = student(20L, 100L, "old-hash");
        prepareManagedStudent(student, classRoom(100L, 10L));

        classRoomService.teacherUpdateStudent(20L, new UpdateStudentRequest("Updated", null, null, "   "));

        assertEquals("Updated", student.displayName);
        assertEquals("old-hash", student.passwordHash);
        verify(passwordEncoder, never()).encode(any());
        verify(userMapper).updateById(student);
    }

    @Test
    void nonBlankValidPasswordIsHashedAndSaved() {
        authenticateTeacher(10L);
        User student = student(20L, 100L, "old-hash");
        prepareManagedStudent(student, classRoom(100L, 10L));
        when(passwordEncoder.encode("secure1")).thenReturn("new-hash");

        classRoomService.teacherUpdateStudent(20L, new UpdateStudentRequest(null, null, null, "secure1"));

        assertEquals("new-hash", student.passwordHash);
        verify(passwordEncoder).encode("secure1");
        verify(userMapper).updateById(student);
    }

    @Test
    void shortNonBlankPasswordIsRejectedBeforePersistence() {
        authenticateTeacher(10L);
        User student = student(20L, 100L, "old-hash");
        when(userMapper.selectById(student.id)).thenReturn(student);
        when(classRoomMapper.selectById(student.classId)).thenReturn(classRoom(100L, 10L));

        BizException exception = assertThrows(
            BizException.class,
            () -> classRoomService.teacherUpdateStudent(20L, new UpdateStudentRequest(null, null, null, "short"))
        );

        assertEquals(ErrorCode.BAD_REQUEST.getCode(), exception.getCode());
        assertEquals("密码长度必须在6-64个字符之间", exception.getMessage());
        assertEquals("old-hash", student.passwordHash);
        verify(userMapper, never()).updateById(any(User.class));
        verify(passwordEncoder, never()).encode(any());
    }

    @Test
    void removeMemberClearsClassIdWithExplicitNullSet() {
        authenticateSuperAdmin(1L);
        when(classRoomMapper.selectById(100L)).thenReturn(classRoom(100L, 10L));

        classRoomService.removeMember(100L, 20L);

        verify(classMemberMapper).delete(any(QueryWrapper.class));
        // MyBatis-Plus updateById 会跳过 null 字段，必须走 UpdateWrapper 显式 set null 才能真正清空
        UpdateWrapper<?> wrapper = capturedClearUpdate();
        // MP 3.5.9 的 where 条件参数在 getSqlSegment() 时才懒加载生成，须先取片段再断言参数
        String segment = wrapper.getSqlSegment();
        assertTrue(wrapper.getSqlSet().contains("class_id"), "sqlSet=" + wrapper.getSqlSet());
        assertTrue(segment.contains("id =") && segment.contains("class_id ="), "segment=" + segment);
        assertTrue(wrapper.getParamNameValuePairs().containsValue(20L), "params=" + wrapper.getParamNameValuePairs());
        verify(userMapper, never()).updateById(any(User.class));
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private UpdateWrapper<?> capturedClearUpdate() {
        ArgumentCaptor<UpdateWrapper> captor = ArgumentCaptor.forClass(UpdateWrapper.class);
        verify(userMapper).update(isNull(), captor.capture());
        return captor.getValue();
    }

    private void authenticateSuperAdmin(Long id) {
        AdminUser admin = new AdminUser();
        admin.id = id;
        admin.username = "admin" + id;
        admin.displayName = "Admin " + id;
        admin.passwordHash = "hash";
        admin.role = "SUPER_ADMIN";
        AuthUser principal = new AuthUser(admin);
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities())
        );
    }

    private void prepareManagedStudent(User student, ClassRoom managedClass) {
        ClassMember member = new ClassMember();
        member.classId = managedClass.id;
        member.userId = student.id;
        member.source = "IMPORT";
        when(userMapper.selectById(student.id)).thenReturn(student);
        when(classRoomMapper.selectById(managedClass.id)).thenReturn(managedClass);
        when(classMemberMapper.selectOne(any(QueryWrapper.class))).thenReturn(member);
    }

    private User student(Long id, Long classId, String passwordHash) {
        User user = new User();
        user.id = id;
        user.classId = classId;
        user.username = "student" + id;
        user.displayName = "Student " + id;
        user.passwordHash = passwordHash;
        user.role = "STUDENT";
        return user;
    }

    private ClassRoom classRoom(Long id, Long teacherId) {
        ClassRoom classRoom = new ClassRoom();
        classRoom.id = id;
        classRoom.name = "Class " + id;
        classRoom.teacherId = teacherId;
        return classRoom;
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
}

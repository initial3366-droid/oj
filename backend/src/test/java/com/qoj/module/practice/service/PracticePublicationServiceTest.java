package com.qoj.module.practice.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.qoj.module.classroom.mapper.ClassMemberMapper;
import com.qoj.module.classroom.mapper.ClassRoomMapper;
import com.qoj.module.practice.entity.PracticePublication;
import com.qoj.module.practice.entity.PracticePublicationClass;
import com.qoj.module.practice.mapper.PracticeMapper;
import com.qoj.module.practice.mapper.PracticeProblemMapper;
import com.qoj.module.practice.mapper.PracticePublicationClassMapper;
import com.qoj.module.practice.mapper.PracticePublicationMapper;
import com.qoj.module.practice.mapper.PracticePublicationProblemMapper;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.service.ProblemService;
import com.qoj.module.user.entity.User;
import com.qoj.security.AuthUser;
import com.qoj.security.policy.ResourceAccessService;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PracticePublicationServiceTest {
    @Mock private PracticePublicationMapper publicationMapper;
    @Mock private PracticePublicationClassMapper publicationClassMapper;
    @Mock private PracticePublicationProblemMapper publicationProblemMapper;
    @Mock private PracticeMapper practiceMapper;
    @Mock private PracticeProblemMapper practiceProblemMapper;
    @Mock private ProblemMapper problemMapper;
    @Mock private ClassRoomMapper classRoomMapper;
    @Mock private ClassMemberMapper classMemberMapper;
    @Mock private ProblemService problemService;
    @Mock private ResourceAccessService resourceAccessService;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private StringRedisTemplate redisTemplate;
    private PracticePublicationService service;

    @BeforeEach
    void setUp() {
        service = new PracticePublicationService(
            publicationMapper, publicationClassMapper, publicationProblemMapper,
            practiceMapper, practiceProblemMapper, problemMapper, classRoomMapper,
            classMemberMapper, problemService, resourceAccessService, passwordEncoder,
            redisTemplate
        );
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void hiddenProblemCannotBeSubmitted() {
        when(publicationMapper.selectById(5L)).thenReturn(publication("ALL"));
        when(publicationProblemMapper.selectCount(any(Wrapper.class))).thenReturn(0L, 1L);

        assertFalse(service.canSubmit(5L, 30L, 100L));
        assertTrue(service.canSubmit(5L, 30L, 101L));
    }

    @Test
    void selectedClassPublicationIsIsolatedByMembership() {
        PracticePublicationClass grant = new PracticePublicationClass();
        grant.publicationId = 5L;
        grant.classId = 9L;
        when(publicationMapper.selectById(5L)).thenReturn(publication("SELECTED_CLASSES"));
        when(publicationClassMapper.selectList(any(Wrapper.class))).thenReturn(List.of(grant));
        when(classMemberMapper.selectCount(any(Wrapper.class))).thenReturn(0L, 1L);
        when(publicationProblemMapper.selectCount(any(Wrapper.class))).thenReturn(1L);

        assertFalse(service.canSubmit(5L, 30L, 100L));
        assertTrue(service.canSubmit(5L, 31L, 100L));
    }

    @Test
    void publicationSnapshotRemainsUsableAfterSourceScopeRevocation() {
        when(publicationMapper.selectById(5L)).thenReturn(publication("ALL"));
        when(publicationProblemMapper.selectCount(any(Wrapper.class))).thenReturn(1L);

        assertTrue(service.canSubmit(5L, 30L, 100L));
    }

    @Test
    void publicListRespectsPublicAndClassScopes() {
        PracticePublication publicPublication = publication(5L, "ALL");
        PracticePublication classPublication = publication(6L, "SELECTED_CLASSES");
        PracticePublicationClass grant = new PracticePublicationClass();
        grant.publicationId = 6L;
        grant.classId = 9L;

        authenticateStudent(30L);
        when(publicationMapper.selectList(any(Wrapper.class)))
            .thenReturn(List.of(publicPublication, classPublication));
        when(publicationClassMapper.selectList(any(Wrapper.class))).thenReturn(List.of(grant));
        when(publicationProblemMapper.selectList(any(Wrapper.class))).thenReturn(List.of());
        when(classMemberMapper.selectCount(any(Wrapper.class))).thenReturn(1L);

        var publicResult = service.publicList(1, 20, "public");
        var classResult = service.publicList(1, 20, "class");
        var allResult = service.publicList(1, 20, "all");

        assertEquals(1, publicResult.total());
        assertEquals(5L, publicResult.list().get(0).id());
        assertEquals(1, classResult.total());
        assertEquals(6L, classResult.list().get(0).id());
        assertEquals(2, allResult.total());
    }

    private PracticePublication publication(String mode) {
        return publication(5L, mode);
    }

    private PracticePublication publication(Long id, String mode) {
        PracticePublication publication = new PracticePublication();
        publication.id = id;
        publication.status = "PUBLISHED";
        publication.studentAccessMode = mode;
        return publication;
    }

    private void authenticateStudent(Long id) {
        User user = new User();
        user.id = id;
        user.username = "student";
        user.passwordHash = "encoded";
        user.displayName = "Student";
        user.role = "STUDENT";
        AuthUser authUser = new AuthUser(user);
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(authUser, null, authUser.getAuthorities())
        );
    }
}

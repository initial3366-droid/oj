package com.qoj.module.practice.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.qoj.module.classroom.mapper.ClassMemberMapper;
import com.qoj.module.classroom.mapper.ClassRoomMapper;
import com.qoj.module.practice.entity.PracticePublication;
import com.qoj.module.practice.entity.PracticePublicationClass;
import com.qoj.module.practice.entity.Practice;
import com.qoj.module.practice.entity.PracticeProblem;
import com.qoj.module.practice.dto.PracticePublicationRequest;
import com.qoj.module.practice.mapper.PracticeMapper;
import com.qoj.module.practice.mapper.PracticeProblemMapper;
import com.qoj.module.practice.mapper.PracticePublicationClassMapper;
import com.qoj.module.practice.mapper.PracticePublicationMapper;
import com.qoj.module.practice.mapper.PracticePublicationProblemMapper;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.service.ProblemService;
import com.qoj.module.user.entity.User;
import com.qoj.module.teacher.entity.Teacher;
import com.qoj.security.AuthUser;
import com.qoj.security.policy.ResourceAccessService;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
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
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
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

    @Test
    void publishingOwnedPracticeUnchangedDoesNotCreateCopy() {
        authenticateTeacher(20L, 3L);
        Practice source = practice(10L, "TEACHER", 20L);
        List<PracticeProblem> sourceProblems = List.of(practiceProblem(10L, 100L, 1), practiceProblem(10L, 101L, 2));
        preparePublish(source, true);
        when(practiceProblemMapper.selectList(any(Wrapper.class))).thenReturn(sourceProblems);

        service.publish(10L, request(visible(100L), visible(101L)));

        verify(practiceMapper, never()).insert(any(Practice.class));
        AtomicReference<PracticePublication> inserted = capturedPublication();
        assertEquals(10L, inserted.get().sourcePracticeId);
    }

    @Test
    void publishingOwnedPracticeWithHiddenProblemsCreatesPrivateCopy() {
        authenticateTeacher(20L, 3L);
        Practice source = practice(10L, "TEACHER", 20L);
        List<PracticeProblem> sourceProblems = List.of(practiceProblem(10L, 100L, 1), practiceProblem(10L, 101L, 2));
        PracticeProblem copiedProblem = practiceProblem(99L, 100L, 1);
        preparePublish(source, true);
        when(practiceProblemMapper.selectList(any(Wrapper.class))).thenReturn(sourceProblems, List.of(copiedProblem));
        doAnswer(invocation -> {
            Practice copy = invocation.getArgument(0);
            copy.id = 99L;
            return 1;
        }).when(practiceMapper).insert(any(Practice.class));

        service.publish(10L, request(visible(100L), hidden(101L)));

        var copyCaptor = org.mockito.ArgumentCaptor.forClass(Practice.class);
        verify(practiceMapper).insert(copyCaptor.capture());
        Practice copy = copyCaptor.getValue();
        assertEquals(20L, copy.ownerId);
        assertEquals("TEACHER", copy.ownerAccountType);
        assertEquals("PRIVATE", copy.accessScope);
        assertEquals(3L, copy.majorId);
        verify(practiceProblemMapper, times(1)).insert(any(PracticeProblem.class));
        assertEquals(99L, capturedPublication().get().sourcePracticeId);
    }

    @Test
    void publishingSharedPracticeCreatesTeacherOwnedCopy() {
        authenticateTeacher(20L, 3L);
        Practice source = practice(10L, "ADMIN", 1L);
        List<PracticeProblem> sourceProblems = List.of(practiceProblem(10L, 100L, 1));
        PracticeProblem copiedProblem = practiceProblem(99L, 100L, 1);
        preparePublish(source, false);
        when(practiceProblemMapper.selectList(any(Wrapper.class))).thenReturn(sourceProblems, List.of(copiedProblem));
        doAnswer(invocation -> {
            Practice copy = invocation.getArgument(0);
            copy.id = 99L;
            return 1;
        }).when(practiceMapper).insert(any(Practice.class));

        service.publish(10L, request(visible(100L)));

        verify(practiceMapper).insert(any(Practice.class));
        assertEquals(99L, capturedPublication().get().sourcePracticeId);
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

    private void preparePublish(Practice source, boolean owner) {
        when(practiceMapper.selectById(source.id)).thenReturn(source);
        when(resourceAccessService.canAccessPractice(any(AuthUser.class), any(Practice.class))).thenReturn(true);
        when(resourceAccessService.isOwner(any(AuthUser.class), any(String.class), any(Long.class))).thenReturn(owner);
        AtomicReference<PracticePublication> publication = new AtomicReference<>();
        doAnswer(invocation -> {
            PracticePublication inserted = invocation.getArgument(0);
            inserted.id = 50L;
            publication.set(inserted);
            return 1;
        }).when(publicationMapper).insert(any(PracticePublication.class));
        when(publicationMapper.selectById(50L)).thenAnswer(invocation -> publication.get());
        when(publicationProblemMapper.selectList(any(Wrapper.class))).thenReturn(List.of());
        when(publicationClassMapper.selectList(any(Wrapper.class))).thenReturn(List.of());
    }

    private AtomicReference<PracticePublication> capturedPublication() {
        AtomicReference<PracticePublication> result = new AtomicReference<>();
        var captor = org.mockito.ArgumentCaptor.forClass(PracticePublication.class);
        verify(publicationMapper).insert(captor.capture());
        result.set(captor.getValue());
        return result;
    }

    private Practice practice(Long id, String ownerType, Long ownerId) {
        Practice practice = new Practice();
        practice.id = id;
        practice.title = "A题单";
        practice.description = "说明";
        practice.ownerAccountType = ownerType;
        practice.ownerId = ownerId;
        practice.isDeleted = false;
        return practice;
    }

    private PracticeProblem practiceProblem(Long practiceId, Long problemId, int order) {
        PracticeProblem item = new PracticeProblem();
        item.practiceId = practiceId;
        item.problemId = problemId;
        item.displayOrder = order;
        item.score = 100;
        return item;
    }

    private PracticePublicationRequest request(PracticePublicationRequest.ProblemVisibilityRequest... problems) {
        return new PracticePublicationRequest("A题单", "说明", "ALL", List.of(), null, List.of(problems));
    }

    private PracticePublicationRequest.ProblemVisibilityRequest visible(Long problemId) {
        return new PracticePublicationRequest.ProblemVisibilityRequest(problemId, "VISIBLE");
    }

    private PracticePublicationRequest.ProblemVisibilityRequest hidden(Long problemId) {
        return new PracticePublicationRequest.ProblemVisibilityRequest(problemId, "HIDDEN");
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

    private void authenticateTeacher(Long id, Long majorId) {
        Teacher teacher = new Teacher();
        teacher.id = id;
        teacher.majorId = majorId;
        teacher.username = "teacher";
        teacher.passwordHash = "encoded";
        teacher.displayName = "Teacher";
        teacher.status = "ACTIVE";
        AuthUser authUser = new AuthUser(teacher);
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(authUser, null, authUser.getAuthorities())
        );
    }
}

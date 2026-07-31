package com.qoj.module.problem.service;

import com.qoj.module.problem.entity.Problem;
import com.qoj.module.problem.entity.ProblemFolder;
import com.qoj.module.problem.entity.ProblemFolderItem;
import com.qoj.module.problem.mapper.ProblemFolderItemMapper;
import com.qoj.module.problem.mapper.ProblemFolderMapper;
import com.qoj.module.problem.mapper.ProblemMapper;
import com.qoj.module.problem.mapper.ProblemTestCaseMapper;
import com.qoj.module.teacher.entity.Teacher;
import com.qoj.module.teacher.mapper.MajorMapper;
import com.qoj.security.AuthUser;
import com.qoj.security.policy.ResourceAccessService;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProblemFolderServiceTest {
    @Mock private ProblemFolderMapper folderMapper;
    @Mock private ProblemFolderItemMapper folderItemMapper;
    @Mock private ProblemMapper problemMapper;
    @Mock private ProblemTestCaseMapper testCaseMapper;
    @Mock private ResourceAccessService resourceAccessService;
    @Mock private MajorMapper majorMapper;

    private ProblemFolderService service;
    private AuthUser teacher;

    @BeforeEach
    void setUp() {
        Teacher account = new Teacher();
        account.id = 10L;
        account.username = "teacher10";
        account.passwordHash = "hash";
        account.displayName = "Teacher 10";
        account.majorId = 3L;
        account.status = "ACTIVE";
        teacher = new AuthUser(account);
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(teacher, null, teacher.getAuthorities())
        );
        service = new ProblemFolderService(
            folderMapper,
            folderItemMapper,
            problemMapper,
            testCaseMapper,
            resourceAccessService,
            majorMapper
        );
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void teacherReferencesAccessibleProblemWithoutMovingIt() {
        ProblemFolder target = new ProblemFolder();
        target.id = 7L;
        target.ownerAccountType = "TEACHER";
        target.ownerId = 10L;

        Problem sharedProblem = new Problem();
        sharedProblem.id = 99L;
        sharedProblem.ownerAccountType = "TEACHER";
        sharedProblem.ownerId = 20L;
        sharedProblem.accessScope = "PRIVATE";
        sharedProblem.folderId = 5L;
        sharedProblem.isDeleted = false;

        when(folderMapper.selectById(7L)).thenReturn(target);
        when(resourceAccessService.isSuperAdmin(teacher)).thenReturn(false);
        when(resourceAccessService.isOwner(teacher, "TEACHER", 10L)).thenReturn(true);
        when(resourceAccessService.isOwner(teacher, "TEACHER", 20L)).thenReturn(false);
        when(resourceAccessService.canUseProblem(teacher, sharedProblem)).thenReturn(true);
        when(problemMapper.selectBatchIds(List.of(99L))).thenReturn(List.of(sharedProblem));
        when(folderItemMapper.selectList(any())).thenReturn(List.of());

        service.replaceProblems(7L, List.of(99L));

        ArgumentCaptor<ProblemFolderItem> itemCaptor = ArgumentCaptor.forClass(ProblemFolderItem.class);
        verify(folderItemMapper).insert(itemCaptor.capture());
        ProblemFolderItem saved = itemCaptor.getValue();
        assertEquals(7L, saved.folderId);
        assertEquals(99L, saved.problemId);
        assertEquals("REFERENCE", saved.relationType);
        assertEquals(5L, sharedProblem.folderId);
        verify(problemMapper, never()).updateById(sharedProblem);
    }

    @Test
    void removingPrimaryFolderKeepsProblemAndSelectsAnotherGrant() {
        ProblemFolder target = new ProblemFolder();
        target.id = 7L;
        target.ownerAccountType = "TEACHER";
        target.ownerId = 10L;
        ProblemFolder defaultFolder = new ProblemFolder();
        defaultFolder.id = 1L;

        Problem problem = new Problem();
        problem.id = 99L;
        problem.folderId = 7L;

        ProblemFolderItem existing = new ProblemFolderItem();
        existing.folderId = 7L;
        existing.problemId = 99L;
        existing.relationType = "GRANT";

        when(folderMapper.selectById(7L)).thenReturn(target);
        when(folderMapper.selectOne(any())).thenReturn(defaultFolder);
        when(resourceAccessService.isSuperAdmin(teacher)).thenReturn(false);
        when(resourceAccessService.isOwner(teacher, "TEACHER", 10L)).thenReturn(true);
        when(problemMapper.selectList(any())).thenReturn(List.of(problem));
        when(folderItemMapper.selectList(any())).thenReturn(List.of());

        service.delete(7L);

        assertNull(problem.folderId);
        verify(problemMapper).updateById(problem);
        verify(folderMapper).deleteById(7L);
    }
}

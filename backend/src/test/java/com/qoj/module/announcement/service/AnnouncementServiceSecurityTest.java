package com.qoj.module.announcement.service;

import com.qoj.common.ErrorCode;
import com.qoj.common.exception.BizException;
import com.qoj.module.announcement.dto.AnnouncementCreateRequest;
import com.qoj.module.announcement.dto.AnnouncementUpdateRequest;
import com.qoj.module.announcement.entity.Announcement;
import com.qoj.module.announcement.mapper.AnnouncementMapper;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.entity.User;
import com.qoj.security.AuthUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
@DisplayName("AnnouncementService security guard")
class AnnouncementServiceSecurityTest {
    @Mock
    private AnnouncementMapper announcementMapper;

    private AnnouncementService announcementService;

    @BeforeEach
    void setUp() {
        announcementService = new AnnouncementService(announcementMapper);
    }

    @Test
    @DisplayName("Create should reject frontend users and non-super admin accounts")
    void create_ShouldRejectNonSuperAdmin() {
        AnnouncementCreateRequest request = createRequest();

        assertForbidden(() -> announcementService.create(request, null));
        assertForbidden(() -> announcementService.create(request, authFrontendUser("STUDENT")));
        assertForbidden(() -> announcementService.create(request, authFrontendUser("TEACHER")));
        assertForbidden(() -> announcementService.create(request, authAdminUser("TEACHER")));

        verifyNoInteractions(announcementMapper);
    }

    @Test
    @DisplayName("Update and delete should reject non-super admin before touching database")
    void updateAndDelete_ShouldRejectNonSuperAdminBeforeDatabaseAccess() {
        AnnouncementUpdateRequest updateRequest = new AnnouncementUpdateRequest();
        updateRequest.title = "new title";
        AuthUser teacher = authAdminUser("TEACHER");

        assertForbidden(() -> announcementService.update(1L, updateRequest, teacher));
        assertForbidden(() -> announcementService.delete(1L, authFrontendUser("STUDENT")));

        verifyNoInteractions(announcementMapper);
    }

    @Test
    @DisplayName("Create should allow SUPER_ADMIN and persist author from authenticated admin")
    void create_ShouldAllowSuperAdmin() {
        AnnouncementCreateRequest request = createRequest();
        request.isVisible = true;
        request.isPinned = false;
        AuthUser superAdmin = authAdminUser("SUPER_ADMIN");

        doAnswer(invocation -> {
            Announcement announcement = invocation.getArgument(0);
            announcement.id = 99L;
            return 1;
        }).when(announcementMapper).insert(any(Announcement.class));

        Long id = announcementService.create(request, superAdmin);

        assertEquals(99L, id);
        ArgumentCaptor<Announcement> captor = ArgumentCaptor.forClass(Announcement.class);
        verify(announcementMapper).insert(captor.capture());
        Announcement saved = captor.getValue();
        assertEquals("安全公告", saved.title);
        assertEquals("<p>content</p>", saved.content);
        assertEquals(superAdmin.id(), saved.authorId);
        assertEquals(superAdmin.displayName(), saved.authorName);
        assertTrue(saved.isVisible);
        assertFalse(saved.isPinned);
        assertFalse(saved.isDeleted);
    }

    private void assertForbidden(Executable executable) {
        BizException exception = assertThrows(BizException.class, executable::execute);
        assertEquals(ErrorCode.FORBIDDEN.getCode(), exception.getCode());
    }

    private AnnouncementCreateRequest createRequest() {
        AnnouncementCreateRequest request = new AnnouncementCreateRequest();
        request.title = "安全公告";
        request.content = "<p>content</p>";
        return request;
    }

    private AuthUser authFrontendUser(String role) {
        User user = new User();
        user.id = 10L;
        user.username = "user-" + role.toLowerCase();
        user.passwordHash = "encoded";
        user.role = role;
        user.displayName = "Frontend " + role;
        return new AuthUser(user);
    }

    private AuthUser authAdminUser(String role) {
        AdminUser adminUser = new AdminUser();
        adminUser.id = 20L;
        adminUser.username = "admin-" + role.toLowerCase();
        adminUser.passwordHash = "encoded";
        adminUser.role = role;
        adminUser.displayName = "Admin " + role;
        return new AuthUser(adminUser);
    }

    @FunctionalInterface
    private interface Executable {
        void execute();
    }
}

package com.qoj.module.announcement.controller;

import com.qoj.module.announcement.dto.AnnouncementCreateRequest;
import com.qoj.module.announcement.dto.AnnouncementUpdateRequest;
import java.lang.reflect.Method;
import java.util.Arrays;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Announcement controller security contract")
class AnnouncementControllerSecurityTest {

    @Test
    @DisplayName("Public announcement controller must expose read-only API")
    void publicAnnouncementController_ShouldBeReadOnly() {
        RequestMapping requestMapping = AnnouncementController.class.getAnnotation(RequestMapping.class);
        assertNotNull(requestMapping);
        assertArrayEquals(new String[]{"/api/v1/announcements"}, requestMapping.value());

        Method[] methods = AnnouncementController.class.getDeclaredMethods();
        assertTrue(Arrays.stream(methods).anyMatch(method -> method.isAnnotationPresent(GetMapping.class)));

        for (Method method : methods) {
            assertFalse(hasWriteMapping(method), "公开公告接口不能出现写操作映射: " + method.getName());
        }
    }

    @Test
    @DisplayName("Admin announcement controller must be restricted to SUPER_ADMIN")
    void adminAnnouncementController_ShouldRequireSuperAdmin() {
        RequestMapping requestMapping = AdminAnnouncementController.class.getAnnotation(RequestMapping.class);
        assertNotNull(requestMapping);
        assertArrayEquals(new String[]{"/api/admin/v1/announcements"}, requestMapping.value());

        PreAuthorize preAuthorize = AdminAnnouncementController.class.getAnnotation(PreAuthorize.class);
        assertNotNull(preAuthorize, "后台公告控制器必须保留方法级权限注解");
        assertEquals("hasRole('SUPER_ADMIN')", preAuthorize.value());
    }

    @Test
    @DisplayName("Announcement write endpoints must only exist under admin controller")
    void announcementWriteEndpoints_ShouldOnlyExistInAdminController() throws NoSuchMethodException {
        Method create = AdminAnnouncementController.class.getDeclaredMethod("create", AnnouncementCreateRequest.class);
        assertNotNull(create.getAnnotation(PostMapping.class));

        Method update = AdminAnnouncementController.class.getDeclaredMethod(
            "update",
            Long.class,
            AnnouncementUpdateRequest.class
        );
        PutMapping updateMapping = update.getAnnotation(PutMapping.class);
        assertNotNull(updateMapping);
        assertArrayEquals(new String[]{"/{id}"}, updateMapping.value());

        Method delete = AdminAnnouncementController.class.getDeclaredMethod("delete", Long.class);
        DeleteMapping deleteMapping = delete.getAnnotation(DeleteMapping.class);
        assertNotNull(deleteMapping);
        assertArrayEquals(new String[]{"/{id}"}, deleteMapping.value());
    }

    private boolean hasWriteMapping(Method method) {
        return method.isAnnotationPresent(PostMapping.class)
            || method.isAnnotationPresent(PutMapping.class)
            || method.isAnnotationPresent(PatchMapping.class)
            || method.isAnnotationPresent(DeleteMapping.class);
    }
}

package com.qoj.common.enums;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class UserRoleTest {

    @Test
    void onlyStudentIsAnActiveFrontendRole() {
        assertTrue(UserRole.isActiveFrontendRole("STUDENT"));
        assertFalse(UserRole.isActiveFrontendRole("GUEST"));
        assertFalse(UserRole.isActiveFrontendRole("VISITOR"));
    }
}

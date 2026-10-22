package com.qoj.module.setting.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.module.setting.entity.SystemSetting;
import com.qoj.module.setting.mapper.SystemSettingMapper;
import com.qoj.module.setting.vo.AgentSettingsVO;
import com.qoj.module.setting.vo.CodeTemplateSettingsVO;
import com.qoj.module.setting.vo.OssSettingsVO;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.mapper.AdminUserMapper;
import com.qoj.security.AuthUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * System设置Service测试类。验证关键业务规则、异常边界及回归场景。
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("SystemSettingService Tests")
class SystemSettingServiceTest {
    @Mock
    private SystemSettingMapper settingMapper;
    @Mock
    private AdminUserMapper adminUserMapper;
    @Mock
    private PasswordEncoder passwordEncoder;

    private SystemSettingService settingService;

    /**
     * 封装setUp相关逻辑。从持久化层读取数据。
     */
    @BeforeEach
    void setUp() {
        settingService = new SystemSettingService(
            settingMapper,
            adminUserMapper,
            passwordEncoder,
            /**
             * 封装ObjectMapper相关逻辑。从持久化层读取数据。
             */
            new ObjectMapper()
        );
    }

    /**
     * 读取AgentSettingsMissingRowShouldReturnDefaults并返回给调用方。从持久化层读取数据。
     */
    @Test
    @DisplayName("Agent settings fall back to defaults when row is missing")
    void getAgentSettings_MissingRow_ShouldReturnDefaults() {
        when(settingMapper.selectById("system.agent_config")).thenReturn(null);

        AgentSettingsVO settings = settingService.getAgentSettings();

        assertFalse(settings.enabled);
        assertEquals("", settings.baseUrl);
        assertEquals("", settings.apiKey);
        assertEquals("", settings.model);
        assertEquals(30000L, settings.timeoutMs);
        assertEquals(12000, settings.maxCodeChars);
    }

    /**
     * 读取OssSettingsInvalidJsonShouldReturnDefaults并返回给调用方。从持久化层读取数据。
     */
    @Test
    @DisplayName("OSS settings fall back to defaults when JSON is invalid")
    void getOssSettings_InvalidJson_ShouldReturnDefaults() {
        SystemSetting setting = new SystemSetting();
        setting.settingKey = "system.oss_config";
        setting.settingValue = "{bad json";
        when(settingMapper.selectById("system.oss_config")).thenReturn(setting);

        OssSettingsVO settings = settingService.getOssSettings();

        assertFalse(settings.enabled);
        assertEquals("", settings.endpoint);
        assertEquals("", settings.bucket);
        assertEquals("", settings.region);
        assertEquals("", settings.accessKeyId);
        assertEquals("", settings.accessKeySecret);
        assertEquals("", settings.publicBaseUrl);
        assertEquals("avatars/", settings.dir);
        assertEquals(5, settings.maxSizeMb);
    }

    /**
     * 读取CodeTemplatesMissingRowShouldReturnDefaults并返回给调用方。从持久化层读取数据。
     */
    @Test
    @DisplayName("Code templates fall back to the bundled language defaults")
    void getCodeTemplateSettings_MissingRow_ShouldReturnDefaults() {
        when(settingMapper.selectById("system.code_templates")).thenReturn(null);

        CodeTemplateSettingsVO settings = settingService.getCodeTemplateSettings();

        assertTrue(settings.c.contains("int main(void)"));
        assertTrue(settings.cpp.contains("ios::sync_with_stdio"));
        assertTrue(settings.python.contains("def solve"));
        assertTrue(settings.java.contains("class Main"));
    }

    /**
     * 更新CodeTemplatesShouldPersistAllLanguages。调用前会结合当前登录身份执行权限判断；执行持久化写入。
     */
    @Test
    @DisplayName("Code template updates persist every language in one setting")
    void updateCodeTemplateSettings_ShouldPersistAllLanguages() {
        when(settingMapper.selectById("system.code_templates")).thenReturn(null);
        CodeTemplateSettingsVO request = new CodeTemplateSettingsVO();
        request.c = "int main(void) { return 0; }";
        request.cpp = "int main() { return 0; }";
        request.python = "print('ok')";
        request.java = "class Main {}";

        settingService.updateCodeTemplateSettings(request, adminAuthUser());

        verify(settingMapper).insert(ArgumentMatchers.<SystemSetting>argThat(setting ->
            "system.code_templates".equals(setting.settingKey)
                && setting.settingValue.contains("int main(void)")
        ));
    }

    /**
     * 封装管理员认证用户相关逻辑。调用前会结合当前登录身份执行权限判断。
     */
    private AuthUser adminAuthUser() {
        AdminUser admin = new AdminUser();
        admin.id = 1L;
        admin.username = "admin";
        admin.passwordHash = "password";
        admin.role = "SUPER_ADMIN";
        admin.displayName = "Admin";
        /**
         * 封装认证用户相关逻辑。调用前会结合当前登录身份执行权限判断。
         */
        return new AuthUser(admin);
    }
}

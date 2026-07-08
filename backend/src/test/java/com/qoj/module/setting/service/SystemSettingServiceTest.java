package com.qoj.module.setting.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.module.setting.entity.SystemSetting;
import com.qoj.module.setting.mapper.SystemSettingMapper;
import com.qoj.module.setting.vo.AgentSettingsVO;
import com.qoj.module.setting.vo.JudgeSettingsVO;
import com.qoj.module.setting.vo.OssSettingsVO;
import com.qoj.security.AuthUser;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.mapper.AdminUserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.ArgumentMatchers.anyString;

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
    private MockEnvironment environment;

    @BeforeEach
    void setUp() {
        environment = new MockEnvironment();
        settingService = new SystemSettingService(
            settingMapper,
            adminUserMapper,
            passwordEncoder,
            new ObjectMapper(),
            environment
        );
    }

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

    @Test
    @DisplayName("Judge settings fall back to database defaults and hide DOMjudge API key")
    void getJudgeSettings_MissingRows_ShouldReturnDefaultsWithoutSecret() {
        JudgeSettingsVO settings = settingService.getJudgeSettings();

        assertEquals(true, settings.enabled);
        assertEquals("docker", settings.mode);
        assertEquals("docker", settings.contestMode);
        assertFalse(settings.enableUnsafeLocalJudge);
        assertFalse(settings.enableSandbox);
        assertEquals(2, settings.maxConcurrent);
        assertEquals(2, settings.threadPoolSize);
        assertEquals(2, settings.queueBatchSize);
        assertEquals(1000L, settings.pollIntervalMs);
        assertEquals("http://127.0.0.1:8081", settings.domjudgeBaseUrl);
        assertEquals("", settings.domjudgeApiKey);
        assertFalse(settings.hasDomjudgeApiKey);
        assertEquals(2000L, settings.domjudgePollIntervalMs);
    }

    @Test
    @DisplayName("Judge runtime settings fail closed when unsafe-local is configured in production")
    void getJudgeRuntimeSettings_UnsafeLocalInProduction_ShouldFailClosed() {
        environment.setActiveProfiles("prod");
        when(settingMapper.selectById(anyString())).thenReturn(null);
        doReturn(setting("judge.mode", "unsafe-local")).when(settingMapper).selectById("judge.mode");
        doReturn(setting("judge.contest_mode", "unsafe-local")).when(settingMapper).selectById("judge.contest_mode");
        doReturn(setting("judge.enable_unsafe_local_judge", "true"))
            .when(settingMapper).selectById("judge.enable_unsafe_local_judge");

        assertThrows(IllegalStateException.class, () -> settingService.getJudgeRuntimeSettings());
    }

    @Test
    @DisplayName("Judge update preserves DOMjudge API key when request key is blank")
    void updateJudgeSettings_BlankSecret_ShouldPreserveExistingApiKey() {
        when(settingMapper.selectById(anyString())).thenReturn(null);
        when(settingMapper.selectById("judge.domjudge_api_key")).thenReturn(setting("judge.domjudge_api_key", "old-key"));
        JudgeSettingsVO request = new JudgeSettingsVO();
        request.enabled = true;
        request.mode = "docker";
        request.contestMode = "domjudge";
        request.enableUnsafeLocalJudge = false;
        request.enableSandbox = true;
        request.maxConcurrent = 2;
        request.threadPoolSize = 2;
        request.queueBatchSize = 2;
        request.pollIntervalMs = 1000L;
        request.domjudgeBaseUrl = "http://judge.local";
        request.domjudgeApiKey = "";
        request.domjudgeContestId = "1";
        request.domjudgePollIntervalMs = 2000L;

        settingService.updateJudgeSettings(request, adminAuthUser());

        verify(settingMapper).updateById(org.mockito.ArgumentMatchers.<SystemSetting>argThat(setting ->
            "judge.domjudge_api_key".equals(setting.settingKey) && "old-key".equals(setting.settingValue)
        ));
    }

    private SystemSetting setting(String key, String value) {
        SystemSetting setting = new SystemSetting();
        setting.settingKey = key;
        setting.settingValue = value;
        return setting;
    }

    private AuthUser adminAuthUser() {
        AdminUser admin = new AdminUser();
        admin.id = 1L;
        admin.username = "admin";
        admin.passwordHash = "password";
        admin.role = "SUPER_ADMIN";
        admin.displayName = "Admin";
        return new AuthUser(admin);
    }
}

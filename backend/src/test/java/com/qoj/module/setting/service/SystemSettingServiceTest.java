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
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.ArgumentMatchers.anyString;

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
    private MockEnvironment environment;

    /**
     * 封装setUp相关逻辑。从持久化层读取数据。
     */
    @BeforeEach
    void setUp() {
        environment = new MockEnvironment();
        settingService = new SystemSettingService(
            settingMapper,
            adminUserMapper,
            passwordEncoder,
            /**
             * 封装ObjectMapper相关逻辑。从持久化层读取数据。
             */
            new ObjectMapper(),
            environment
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
     * 读取判题SettingsMissingRowsShouldReturnDefaultsWithoutSecret并返回给调用方。可能调用外部判题或网关服务。
     */
    @Test
    @DisplayName("Judge settings use fixed engines and hide the CCPCOJ password hash")
    void getJudgeSettings_MissingRows_ShouldReturnDefaultsWithoutSecret() {
        JudgeSettingsVO settings = settingService.getJudgeSettings();

        assertTrue(settings.enabled);
        assertEquals("go-judge", settings.mode);
        assertEquals("per-contest", settings.contestMode);
        assertFalse(settings.enableSandbox);
        assertEquals(2, settings.maxConcurrent);
        assertEquals(2, settings.threadPoolSize);
        assertEquals(2, settings.queueBatchSize);
        assertEquals(1000L, settings.pollIntervalMs);
        assertEquals("judger", settings.ccpcojJudgeUsername);
        assertEquals("", settings.ccpcojJudgePassword);
        assertFalse(settings.hasCcpcojJudgePassword);
        assertEquals(720, settings.ccpcojSessionTtlMinutes);
        assertEquals(15, settings.ccpcojStaleTaskMinutes);
    }

    /**
     * 读取判题RuntimeSettingsShouldUseFixedEngines并返回给调用方。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Test
    @DisplayName("Judge runtime ownership is fixed")
    void getJudgeRuntimeSettings_ShouldUseFixedEngines() {
        JudgeSettingsVO settings = settingService.getJudgeRuntimeSettings();

        assertEquals("go-judge", settings.mode);
        assertEquals("per-contest", settings.contestMode);
    }

    /**
     * 更新判题SettingsBlankPasswordShouldPreserveExistingHash。调用前会结合当前登录身份执行权限判断；执行持久化写入；可能调用外部判题或网关服务。
     */
    @Test
    @DisplayName("Judge update preserves the CCPCOJ password hash when password is blank")
    void updateJudgeSettings_BlankPassword_ShouldPreserveExistingHash() {
        when(settingMapper.selectById(anyString())).thenReturn(null);
        when(settingMapper.selectById("judge.ccpcoj_password_hash"))
            .thenReturn(setting("judge.ccpcoj_password_hash", "old-password-hash"));
        JudgeSettingsVO request = new JudgeSettingsVO();
        request.enabled = true;
        request.enableSandbox = true;
        request.maxConcurrent = 2;
        request.threadPoolSize = 2;
        request.queueBatchSize = 2;
        request.pollIntervalMs = 1000L;
        request.ccpcojJudgeUsername = "judger";
        request.ccpcojJudgePassword = "";
        request.ccpcojSessionTtlMinutes = 720;
        request.ccpcojStaleTaskMinutes = 15;

        settingService.updateJudgeSettings(request, adminAuthUser());

        /**
         * 校验前置条件。执行持久化写入；可能调用外部判题或网关服务。
         */
        verify(settingMapper).updateById(org.mockito.ArgumentMatchers.<SystemSetting>argThat(setting ->
            "judge.ccpcoj_password_hash".equals(setting.settingKey)
                && "old-password-hash".equals(setting.settingValue)
        ));
    }

    /**
     * 更新判题SettingsMissingPasswordShouldRemainOptional。调用前会结合当前登录身份执行权限判断；执行持久化写入；可能调用外部判题或网关服务。
     */
    @Test
    @DisplayName("Judge settings can be saved before CCPCOJ credentials are configured")
    void updateJudgeSettings_MissingPassword_ShouldRemainOptional() {
        when(settingMapper.selectById(anyString())).thenReturn(null);
        JudgeSettingsVO request = new JudgeSettingsVO();
        request.enabled = true;
        request.enableSandbox = true;
        request.maxConcurrent = 2;
        request.threadPoolSize = 2;
        request.queueBatchSize = 2;
        request.pollIntervalMs = 1000L;
        request.ccpcojJudgeUsername = "judger";
        request.ccpcojJudgePassword = "";
        request.ccpcojSessionTtlMinutes = 720;
        request.ccpcojStaleTaskMinutes = 15;

        assertDoesNotThrow(() -> settingService.updateJudgeSettings(request, adminAuthUser()));

        /**
         * 校验前置条件。执行持久化写入；可能调用外部判题或网关服务。
         */
        verify(settingMapper).insert(org.mockito.ArgumentMatchers.<SystemSetting>argThat(setting ->
            "judge.ccpcoj_password_hash".equals(setting.settingKey)
                && "".equals(setting.settingValue)
        ));
    }

    /**
     * 封装设置相关逻辑。直接返回当前实例保存的设置，不产生额外的数据写入。
     */
    private SystemSetting setting(String key, String value) {
        SystemSetting setting = new SystemSetting();
        setting.settingKey = key;
        setting.settingValue = value;
        return setting;
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

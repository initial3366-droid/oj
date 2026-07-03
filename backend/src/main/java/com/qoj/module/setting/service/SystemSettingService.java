package com.qoj.module.setting.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.ErrorCode;
import com.qoj.common.exception.BizException;
import com.qoj.module.setting.dto.EmailConfigRequest;
import com.qoj.module.setting.dto.PasswordChangeRequest;
import com.qoj.module.setting.entity.SystemSetting;
import com.qoj.module.setting.mapper.SystemSettingMapper;
import com.qoj.module.setting.vo.AgentSettingsVO;
import com.qoj.module.setting.vo.FrontendSettingsVO;
import com.qoj.module.setting.vo.JudgeSettingsVO;
import com.qoj.module.setting.vo.OssSettingsVO;
import com.qoj.module.setting.vo.RegisterSettingsVO;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.mapper.AdminUserMapper;
import com.qoj.security.AuthUser;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;

@Service
public class SystemSettingService {
    private static final String DEFAULT_EMAIL_SUBJECT = "QOJ 注册验证码";
    private static final String DEFAULT_EMAIL_CONTENT = "您好，\n\n您的验证码是: {{code}}\n\n验证码将在10分钟后过期，请勿泄露给他人。\n\nQOJ Online Judge System";
    private static final String AGENT_CONFIG_KEY = "system.agent_config";
    private static final String OSS_CONFIG_KEY = "system.oss_config";
    private static final int DEFAULT_JUDGE_CONCURRENCY = 2;
    private static final int DEFAULT_JUDGE_THREAD_POOL_SIZE = 2;
    private static final int DEFAULT_JUDGE_QUEUE_BATCH_SIZE = 2;
    private static final long DEFAULT_JUDGE_POLL_INTERVAL_MS = 1000L;
    private static final long DEFAULT_DOMJUDGE_POLL_INTERVAL_MS = 2000L;
    private static final Map<String, Object> DEFAULT_AGENT_CONFIG = Map.of(
        "enabled", false,
        "baseUrl", "",
        "apiKey", "",
        "model", "",
        "timeoutMs", 30000L,
        "maxCodeChars", 12000
    );
    private static final Map<String, Object> DEFAULT_OSS_CONFIG = Map.of(
        "enabled", false,
        "endpoint", "",
        "bucket", "",
        "region", "",
        "accessKeyId", "",
        "accessKeySecret", "",
        "publicBaseUrl", "",
        "dir", "avatars/",
        "maxSizeMb", 5
    );

    private final SystemSettingMapper settingMapper;
    private final AdminUserMapper adminUserMapper;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;

    public SystemSettingService(
        SystemSettingMapper settingMapper,
        AdminUserMapper adminUserMapper,
        PasswordEncoder passwordEncoder,
        ObjectMapper objectMapper
    ) {
        this.settingMapper = settingMapper;
        this.adminUserMapper = adminUserMapper;
        this.passwordEncoder = passwordEncoder;
        this.objectMapper = objectMapper;
    }

    /**
     * 获取前端配置
     */
    public FrontendSettingsVO getFrontendSettings() {
        FrontendSettingsVO vo = new FrontendSettingsVO();

        SystemSetting siteTitle = settingMapper.selectById("frontend.site_title");
        vo.siteTitle = siteTitle != null ? siteTitle.settingValue : "QOJ 在线评测系统";

        SystemSetting siteLogo = settingMapper.selectById("frontend.site_logo");
        vo.siteLogo = siteLogo != null ? siteLogo.settingValue : "";

        SystemSetting maintenanceMode = settingMapper.selectById("frontend.maintenance_mode");
        vo.maintenanceMode = maintenanceMode != null ? Boolean.parseBoolean(maintenanceMode.settingValue) : false;

        SystemSetting footerText = settingMapper.selectById("frontend.footer_text");
        vo.footerText = footerText != null ? footerText.settingValue : "QOJ 在线评测系统";

        SystemSetting icpNumber = settingMapper.selectById("frontend.icp_number");
        vo.icpNumber = icpNumber != null ? icpNumber.settingValue : "";

        SystemSetting footerLink1Text = settingMapper.selectById("frontend.footer_link1_text");
        vo.footerLink1Text = footerLink1Text != null ? footerLink1Text.settingValue : "";

        SystemSetting footerLink1Url = settingMapper.selectById("frontend.footer_link1_url");
        vo.footerLink1Url = footerLink1Url != null ? footerLink1Url.settingValue : "";

        SystemSetting footerLink2Text = settingMapper.selectById("frontend.footer_link2_text");
        vo.footerLink2Text = footerLink2Text != null ? footerLink2Text.settingValue : "";

        SystemSetting footerLink2Url = settingMapper.selectById("frontend.footer_link2_url");
        vo.footerLink2Url = footerLink2Url != null ? footerLink2Url.settingValue : "";

        return vo;
    }

    /**
     * 获取注册配置
     */
    public RegisterSettingsVO getRegisterSettings() {
        RegisterSettingsVO vo = new RegisterSettingsVO();

        SystemSetting enabled = settingMapper.selectById("register.enabled");
        vo.enabled = enabled != null ? Boolean.parseBoolean(enabled.settingValue) : true;

        SystemSetting emailVerification = settingMapper.selectById("register.email_verification");
        vo.emailVerification = emailVerification != null ? Boolean.parseBoolean(emailVerification.settingValue) : false;

        SystemSetting emailConfig = settingMapper.selectById("register.email_config");
        if (emailConfig != null && emailConfig.settingValue != null && !emailConfig.settingValue.equals("{}")) {
            Map<String, Object> config = parseJson(emailConfig.settingValue, new TypeReference<Map<String, Object>>() {});
            RegisterSettingsVO.EmailConfigVO emailConfigVO = new RegisterSettingsVO.EmailConfigVO();
            emailConfigVO.host = (String) config.get("host");
            emailConfigVO.port = (Integer) config.get("port");
            emailConfigVO.username = (String) config.get("username");
            emailConfigVO.useSsl = (Boolean) config.getOrDefault("useSsl", true);
            emailConfigVO.subject = (String) config.get("subject");
            emailConfigVO.content = (String) config.get("content");
            vo.emailConfig = emailConfigVO;
        } else {
            vo.emailConfig = new RegisterSettingsVO.EmailConfigVO();
        }

        SystemSetting fieldsConfig = settingMapper.selectById("register.fields_config");
        if (fieldsConfig != null) {
            vo.fieldsConfig = parseJson(fieldsConfig.settingValue, RegisterSettingsVO.FieldsConfigVO.class);
        } else {
            vo.fieldsConfig = new RegisterSettingsVO.FieldsConfigVO();
        }

        return vo;
    }

    public JudgeSettingsVO getJudgeSettings() {
        JudgeSettingsVO vo = getJudgeRuntimeSettings();
        vo.domjudgeApiKey = "";
        return vo;
    }

    public JudgeSettingsVO getJudgeRuntimeSettings() {
        JudgeSettingsVO vo = new JudgeSettingsVO();
        vo.enabled = boolSetting("judge.enabled", true);
        vo.mode = normalizeJudgeMode(textSetting("judge.mode", "docker"));
        vo.contestMode = normalizeJudgeMode(textSetting("judge.contest_mode", vo.mode));
        vo.enableUnsafeLocalJudge = boolSetting("judge.enable_unsafe_local_judge", false);
        vo.enableSandbox = boolSetting("judge.enable_sandbox", true);
        vo.threadPoolSize = positiveIntSetting("judge.thread_pool_size", DEFAULT_JUDGE_THREAD_POOL_SIZE);
        vo.maxConcurrent = positiveIntSetting("judge.max_concurrent", DEFAULT_JUDGE_CONCURRENCY);
        vo.queueBatchSize = positiveIntSetting("judge.queue_batch_size", DEFAULT_JUDGE_QUEUE_BATCH_SIZE);
        vo.pollIntervalMs = positiveLongSetting("judge.poll_interval_ms", DEFAULT_JUDGE_POLL_INTERVAL_MS);
        vo.domjudgeBaseUrl = textSetting("judge.domjudge_base_url", "http://127.0.0.1:8081");
        vo.domjudgeApiKey = textSetting("judge.domjudge_api_key", "");
        vo.hasDomjudgeApiKey = hasText(vo.domjudgeApiKey);
        vo.domjudgeContestId = textSetting("judge.domjudge_contest_id", "");
        vo.domjudgePollIntervalMs = positiveLongSetting("judge.domjudge_poll_interval_ms", DEFAULT_DOMJUDGE_POLL_INTERVAL_MS);
        return vo;
    }

    /**
     * 获取后台展示用 AI 助手配置。密钥不回显。
     */
    public AgentSettingsVO getAgentSettings() {
        AgentSettingsVO vo = getAgentRuntimeSettings();
        vo.apiKey = "";
        return vo;
    }

    /**
     * 获取运行时 AI 助手配置，包含密钥，仅供后端调用。
     */
    public AgentSettingsVO getAgentRuntimeSettings() {
        Map<String, Object> config = getJsonSetting(AGENT_CONFIG_KEY, DEFAULT_AGENT_CONFIG);
        AgentSettingsVO vo = new AgentSettingsVO();
        vo.enabled = boolValue(config.get("enabled"), false);
        vo.baseUrl = stringValue(config.get("baseUrl"));
        vo.apiKey = stringValue(config.get("apiKey"));
        vo.model = stringValue(config.get("model"));
        vo.timeoutMs = longValue(config.get("timeoutMs"), 30000L);
        vo.maxCodeChars = intValue(config.get("maxCodeChars"), 12000);
        return vo;
    }

    /**
     * 获取后台展示用 OSS 配置。密钥不回显。
     */
    public OssSettingsVO getOssSettings() {
        OssSettingsVO vo = getOssRuntimeSettings();
        vo.accessKeySecret = "";
        return vo;
    }

    /**
     * 获取运行时 OSS 配置，包含密钥，仅供后端调用。
     */
    public OssSettingsVO getOssRuntimeSettings() {
        Map<String, Object> config = getJsonSetting(OSS_CONFIG_KEY, DEFAULT_OSS_CONFIG);
        OssSettingsVO vo = new OssSettingsVO();
        vo.enabled = boolValue(config.get("enabled"), false);
        vo.endpoint = stringValue(config.get("endpoint"));
        vo.bucket = stringValue(config.get("bucket"));
        vo.region = stringValue(config.get("region"));
        vo.accessKeyId = stringValue(config.get("accessKeyId"));
        vo.accessKeySecret = stringValue(config.get("accessKeySecret"));
        vo.publicBaseUrl = stringValue(config.get("publicBaseUrl"));
        vo.dir = defaultText(config.get("dir"), "avatars/");
        vo.maxSizeMb = intValue(config.get("maxSizeMb"), 5);
        return vo;
    }

    /**
     * 判题开关是否已关闭（判题入口与调度器共用此判断）
     */
    public boolean isJudgeEnabled() {
        return getJudgeSettings().enabled;
    }

    /**
     * 更新判题开关
     */
    @Transactional
    public void updateJudgeEnabled(Boolean enabled, AuthUser authUser) {
        updateSetting("judge.enabled", String.valueOf(Boolean.TRUE.equals(enabled)), authUser.getUsername());
    }

    /**
     * 更新判题最大并发数
     *
     * <p>取值范围 (0, threadPoolSize]，超出上限或非正数将被拒绝。
     */
    @Transactional
    public void updateJudgeMaxConcurrent(Integer maxConcurrent, AuthUser authUser) {
        int threadPoolSize = positiveIntSetting("judge.thread_pool_size", DEFAULT_JUDGE_THREAD_POOL_SIZE);
        if (maxConcurrent == null || maxConcurrent <= 0 || maxConcurrent > threadPoolSize) {
            throw new BizException(ErrorCode.BAD_REQUEST,
                "判题最大并发数必须为正整数且不超过线程池大小 " + threadPoolSize);
        }
        updateSetting("judge.max_concurrent", String.valueOf(maxConcurrent), authUser.getUsername());
    }

    @Transactional
    public void updateJudgeSettings(JudgeSettingsVO request, AuthUser authUser) {
        JudgeSettingsVO existing = getJudgeRuntimeSettings();
        JudgeSettingsVO next = new JudgeSettingsVO();
        next.enabled = request.enabled;
        next.mode = normalizeJudgeModeForUpdate(request.mode);
        next.contestMode = normalizeJudgeModeForUpdate(request.contestMode);
        next.enableUnsafeLocalJudge = request.enableUnsafeLocalJudge;
        next.enableSandbox = request.enableSandbox;
        next.threadPoolSize = request.threadPoolSize;
        next.maxConcurrent = request.maxConcurrent;
        next.queueBatchSize = request.queueBatchSize;
        next.pollIntervalMs = request.pollIntervalMs;
        next.domjudgeBaseUrl = trimToEmpty(request.domjudgeBaseUrl);
        next.domjudgeApiKey = hasText(request.domjudgeApiKey) ? request.domjudgeApiKey.trim() : existing.domjudgeApiKey;
        next.domjudgeContestId = trimToEmpty(request.domjudgeContestId);
        next.domjudgePollIntervalMs = request.domjudgePollIntervalMs;

        validateJudgeSettings(next);

        String username = authUser.getUsername();
        updateSetting("judge.enabled", String.valueOf(next.enabled), username);
        updateSetting("judge.mode", next.mode, username);
        updateSetting("judge.contest_mode", next.contestMode, username);
        updateSetting("judge.enable_unsafe_local_judge", String.valueOf(next.enableUnsafeLocalJudge), username);
        updateSetting("judge.enable_sandbox", String.valueOf(next.enableSandbox), username);
        updateSetting("judge.max_concurrent", String.valueOf(next.maxConcurrent), username);
        updateSetting("judge.thread_pool_size", String.valueOf(next.threadPoolSize), username);
        updateSetting("judge.queue_batch_size", String.valueOf(next.queueBatchSize), username);
        updateSetting("judge.poll_interval_ms", String.valueOf(next.pollIntervalMs), username);
        updateSetting("judge.domjudge_base_url", next.domjudgeBaseUrl, username);
        updateSetting("judge.domjudge_api_key", next.domjudgeApiKey == null ? "" : next.domjudgeApiKey, username);
        updateSetting("judge.domjudge_contest_id", next.domjudgeContestId, username);
        updateSetting("judge.domjudge_poll_interval_ms", String.valueOf(next.domjudgePollIntervalMs), username);
    }

    /**
     * 更新 AI 助手配置。apiKey 留空时保留原值。
     */
    @Transactional
    public void updateAgentSettings(AgentSettingsVO request, AuthUser authUser) {
        AgentSettingsVO existing = getAgentRuntimeSettings();
        AgentSettingsVO next = new AgentSettingsVO();
        next.enabled = Boolean.TRUE.equals(request.enabled);
        next.baseUrl = trimToEmpty(request.baseUrl);
        next.apiKey = hasText(request.apiKey) ? request.apiKey.trim() : existing.apiKey;
        next.model = trimToEmpty(request.model);
        next.timeoutMs = request.timeoutMs != null ? request.timeoutMs : 30000L;
        next.maxCodeChars = request.maxCodeChars != null ? request.maxCodeChars : 12000;

        if (Boolean.TRUE.equals(next.enabled)) {
            if (!hasText(next.baseUrl)) {
                throw new BizException(ErrorCode.BAD_REQUEST, "请填写 AI 服务地址");
            }
            if (!hasText(next.apiKey)) {
                throw new BizException(ErrorCode.BAD_REQUEST, "请填写 AI API Key");
            }
            if (!hasText(next.model)) {
                throw new BizException(ErrorCode.BAD_REQUEST, "请填写 AI 模型名称");
            }
        }
        if (next.timeoutMs < 1000 || next.timeoutMs > 120000) {
            throw new BizException(ErrorCode.BAD_REQUEST, "AI 请求超时时间必须在 1000-120000 毫秒之间");
        }
        if (next.maxCodeChars < 1000 || next.maxCodeChars > 50000) {
            throw new BizException(ErrorCode.BAD_REQUEST, "代码上下文长度必须在 1000-50000 之间");
        }

        Map<String, Object> config = Map.of(
            "enabled", next.enabled,
            "baseUrl", next.baseUrl,
            "apiKey", next.apiKey == null ? "" : next.apiKey,
            "model", next.model,
            "timeoutMs", next.timeoutMs,
            "maxCodeChars", next.maxCodeChars
        );
        updateSetting(AGENT_CONFIG_KEY, toJson(config), authUser.getUsername());
    }

    /**
     * 更新 OSS 配置。accessKeySecret 留空时保留原值。
     */
    @Transactional
    public void updateOssSettings(OssSettingsVO request, AuthUser authUser) {
        OssSettingsVO existing = getOssRuntimeSettings();
        OssSettingsVO next = new OssSettingsVO();
        next.enabled = Boolean.TRUE.equals(request.enabled);
        next.endpoint = trimToEmpty(request.endpoint);
        next.bucket = trimToEmpty(request.bucket);
        next.region = trimToEmpty(request.region);
        next.accessKeyId = trimToEmpty(request.accessKeyId);
        next.accessKeySecret = hasText(request.accessKeySecret) ? request.accessKeySecret.trim() : existing.accessKeySecret;
        next.publicBaseUrl = trimToEmpty(request.publicBaseUrl);
        next.dir = hasText(request.dir) ? request.dir.trim() : "avatars/";
        next.maxSizeMb = request.maxSizeMb != null ? request.maxSizeMb : 5;

        if (!next.dir.endsWith("/")) {
            next.dir = next.dir + "/";
        }
        if (Boolean.TRUE.equals(next.enabled)) {
            if (!hasText(next.endpoint)) {
                throw new BizException(ErrorCode.BAD_REQUEST, "请填写 OSS Endpoint");
            }
            if (!hasText(next.bucket)) {
                throw new BizException(ErrorCode.BAD_REQUEST, "请填写 OSS Bucket");
            }
            if (!hasText(next.accessKeyId)) {
                throw new BizException(ErrorCode.BAD_REQUEST, "请填写 OSS AccessKey ID");
            }
            if (!hasText(next.accessKeySecret)) {
                throw new BizException(ErrorCode.BAD_REQUEST, "请填写 OSS AccessKey Secret");
            }
            if (!hasText(next.publicBaseUrl)) {
                throw new BizException(ErrorCode.BAD_REQUEST, "请填写 OSS 公开访问地址");
            }
        }
        if (next.maxSizeMb < 1 || next.maxSizeMb > 20) {
            throw new BizException(ErrorCode.BAD_REQUEST, "头像最大体积必须在 1-20 MB 之间");
        }

        Map<String, Object> config = Map.of(
            "enabled", next.enabled,
            "endpoint", next.endpoint,
            "bucket", next.bucket,
            "region", next.region,
            "accessKeyId", next.accessKeyId,
            "accessKeySecret", next.accessKeySecret == null ? "" : next.accessKeySecret,
            "publicBaseUrl", next.publicBaseUrl,
            "dir", next.dir,
            "maxSizeMb", next.maxSizeMb
        );
        updateSetting(OSS_CONFIG_KEY, toJson(config), authUser.getUsername());
    }

    /**
     * 更新站点标题
     */
    @Transactional
    public void updateSiteTitle(String title, AuthUser authUser) {
        updateSetting("frontend.site_title", title, authUser.getUsername());
    }

    /**
     * 更新站点 Logo
     */
    @Transactional
    public void updateSiteLogo(String logoUrl, AuthUser authUser) {
        updateSetting("frontend.site_logo", logoUrl == null ? "" : logoUrl, authUser.getUsername());
    }

    /**
     * 更新维护模式
     */
    @Transactional
    public void updateMaintenanceMode(Boolean enabled, AuthUser authUser) {
        updateSetting("frontend.maintenance_mode", String.valueOf(enabled), authUser.getUsername());
    }

    /**
     * 更新前端配置
     */
    @Transactional
    public void updateFrontendSettings(
        String siteTitle,
        String siteLogo,
        Boolean maintenanceMode,
        String footerText,
        String icpNumber,
        String footerLink1Text,
        String footerLink1Url,
        String footerLink2Text,
        String footerLink2Url,
        AuthUser authUser
    ) {
        updateSiteTitle(siteTitle, authUser);
        updateSiteLogo(siteLogo, authUser);
        updateMaintenanceMode(maintenanceMode, authUser);
        updateFooterText(footerText, authUser);
        updateIcpNumber(icpNumber, authUser);
        updateFooterLinks(
            footerLink1Text,
            footerLink1Url,
            footerLink2Text,
            footerLink2Url,
            authUser
        );
    }

    /**
     * 更新底部文案
     */
    @Transactional
    public void updateFooterText(String text, AuthUser authUser) {
        updateSetting("frontend.footer_text", text == null ? "" : text, authUser.getUsername());
    }

    /**
     * 更新备案号
     */
    @Transactional
    public void updateIcpNumber(String icpNumber, AuthUser authUser) {
        updateSetting("frontend.icp_number", icpNumber == null ? "" : icpNumber, authUser.getUsername());
    }

    /**
     * 更新底部右侧链接
     */
    @Transactional
    public void updateFooterLinks(
        String link1Text,
        String link1Url,
        String link2Text,
        String link2Url,
        AuthUser authUser
    ) {
        String username = authUser.getUsername();
        updateSetting("frontend.footer_link1_text", link1Text == null ? "" : link1Text, username);
        updateSetting("frontend.footer_link1_url", link1Url == null ? "" : link1Url, username);
        updateSetting("frontend.footer_link2_text", link2Text == null ? "" : link2Text, username);
        updateSetting("frontend.footer_link2_url", link2Url == null ? "" : link2Url, username);
    }

    /**
     * 修改管理员密码
     */
    @Transactional
    public void changeAdminPassword(PasswordChangeRequest request, AuthUser authUser) {
        AdminUser adminUser = adminUserMapper.selectById(authUser.id());
        if (adminUser == null) {
            throw new BizException(ErrorCode.NOT_FOUND, "管理员不存在");
        }

        if (!passwordEncoder.matches(request.oldPassword, adminUser.passwordHash)) {
            throw new BizException(ErrorCode.FORBIDDEN, "旧密码错误");
        }

        adminUser.passwordHash = passwordEncoder.encode(request.newPassword);
        adminUserMapper.updateById(adminUser);
    }

    /**
     * 更新注册开关
     */
    @Transactional
    public void updateRegisterEnabled(Boolean enabled, AuthUser authUser) {
        updateSetting("register.enabled", String.valueOf(enabled), authUser.getUsername());
    }

    /**
     * 更新邮箱验证开关
     */
    @Transactional
    public void updateEmailVerification(Boolean enabled, AuthUser authUser) {
        updateSetting("register.email_verification", String.valueOf(enabled), authUser.getUsername());
    }

    /**
     * 更新邮箱配置
     */
    @Transactional
    public void updateEmailConfig(EmailConfigRequest request, AuthUser authUser) {
        // 读取原有配置
        String originalPassword = null;
        SystemSetting existingSetting = settingMapper.selectById("register.email_config");
        if (existingSetting != null && existingSetting.settingValue != null && !existingSetting.settingValue.isEmpty()) {
            try {
                Map<String, Object> existingConfig = parseJson(
                    existingSetting.settingValue,
                    new TypeReference<Map<String, Object>>() {}
                );
                originalPassword = (String) existingConfig.get("password");
            } catch (Exception e) {
                // 解析失败，使用新密码
            }
        }

        // 如果新密码为空或只包含空格，使用原密码
        String passwordToSave = (request.password == null || request.password.trim().isEmpty())
            ? originalPassword
            : request.password;

        // 如果没有原密码且新密码也为空，则报错
        if (passwordToSave == null || passwordToSave.isEmpty()) {
            throw new BizException(ErrorCode.BAD_REQUEST, "邮箱密码不能为空");
        }

        Map<String, Object> config = Map.of(
            "host", request.host,
            "port", request.port != null ? request.port : 587,
            "username", request.username,
            "password", passwordToSave,
            "useSsl", request.useSsl != null ? request.useSsl : true,
            "subject", hasText(request.subject) ? request.subject.trim() : DEFAULT_EMAIL_SUBJECT,
            "content", hasText(request.content) ? request.content : DEFAULT_EMAIL_CONTENT
        );
        updateSetting("register.email_config", toJson(config), authUser.getUsername());
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String trimToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    /**
     * 更新注册字段配置
     */
    @Transactional
    public void updateFieldsConfig(RegisterSettingsVO.FieldsConfigVO config, AuthUser authUser) {
        updateSetting("register.fields_config", toJson(config), authUser.getUsername());
    }

    /**
     * 通用更新设置方法
     */
    private void updateSetting(String key, String value, String updatedBy) {
        SystemSetting setting = settingMapper.selectById(key);
        if (setting == null) {
            setting = new SystemSetting();
            setting.settingKey = key;
            setting.category = key.startsWith("frontend.") ? "frontend" : key.split("\\.")[0];
            setting.description = settingDescription(key);
            setting.settingValue = value;
            setting.updatedBy = updatedBy;
            setting.updatedAt = LocalDateTime.now();
            settingMapper.insert(setting);
            return;
        }

        setting.settingValue = value;
        setting.updatedBy = updatedBy;
        setting.updatedAt = LocalDateTime.now();
        settingMapper.updateById(setting);
    }

    private String settingDescription(String key) {
        return switch (key) {
            case "frontend.site_title" -> "站点标题";
            case "frontend.site_logo" -> "站点Logo";
            case "frontend.footer_text" -> "底部文案";
            case "frontend.icp_number" -> "备案号";
            case "frontend.footer_link1_text" -> "底部链接1文字";
            case "frontend.footer_link1_url" -> "底部链接1地址";
            case "frontend.footer_link2_text" -> "底部链接2文字";
            case "frontend.footer_link2_url" -> "底部链接2地址";
            case "judge.enabled" -> "判题开关";
            case "judge.mode" -> "判题模式";
            case "judge.contest_mode" -> "比赛判题模式";
            case "judge.enable_unsafe_local_judge" -> "不安全本地判题开关";
            case "judge.enable_sandbox" -> "沙箱调试开关";
            case "judge.max_concurrent" -> "判题最大并发数";
            case "judge.thread_pool_size" -> "判题线程池大小";
            case "judge.queue_batch_size" -> "判题队列批量拉取数";
            case "judge.poll_interval_ms" -> "判题队列轮询间隔";
            case "judge.domjudge_base_url" -> "DOMjudge 地址";
            case "judge.domjudge_api_key" -> "DOMjudge API Key";
            case "judge.domjudge_contest_id" -> "DOMjudge 默认比赛 ID";
            case "judge.domjudge_poll_interval_ms" -> "DOMjudge 结果轮询间隔";
            case AGENT_CONFIG_KEY -> "AI助手配置";
            case OSS_CONFIG_KEY -> "OSS配置";
            default -> key;
        };
    }

    private void validateJudgeSettings(JudgeSettingsVO settings) {
        if (settings.threadPoolSize <= 0 || settings.threadPoolSize > 64) {
            throw new BizException(ErrorCode.BAD_REQUEST, "判题线程池大小必须在 1-64 之间");
        }
        if (settings.maxConcurrent <= 0 || settings.maxConcurrent > settings.threadPoolSize) {
            throw new BizException(ErrorCode.BAD_REQUEST,
                "判题最大并发数必须为正整数且不超过线程池大小 " + settings.threadPoolSize);
        }
        if (settings.queueBatchSize <= 0 || settings.queueBatchSize > 100) {
            throw new BizException(ErrorCode.BAD_REQUEST, "队列批量拉取数必须在 1-100 之间");
        }
        if (settings.pollIntervalMs < 200 || settings.pollIntervalMs > 60000) {
            throw new BizException(ErrorCode.BAD_REQUEST, "判题队列轮询间隔必须在 200-60000 毫秒之间");
        }
        if (settings.domjudgePollIntervalMs < 500 || settings.domjudgePollIntervalMs > 60000) {
            throw new BizException(ErrorCode.BAD_REQUEST, "DOMjudge 轮询间隔必须在 500-60000 毫秒之间");
        }
        if (("unsafe-local".equals(settings.mode) || "unsafe-local".equals(settings.contestMode))
            && !settings.enableUnsafeLocalJudge) {
            throw new BizException(ErrorCode.BAD_REQUEST, "使用不安全本地判题模式时必须开启不安全本地判题");
        }
        if ("domjudge".equals(settings.mode) || "domjudge".equals(settings.contestMode)) {
            if (!hasText(settings.domjudgeBaseUrl)) {
                throw new BizException(ErrorCode.BAD_REQUEST, "请填写 DOMjudge 地址");
            }
            if (!hasText(settings.domjudgeApiKey)) {
                throw new BizException(ErrorCode.BAD_REQUEST, "请填写 DOMjudge API Key");
            }
            if (!hasText(settings.domjudgeContestId)) {
                throw new BizException(ErrorCode.BAD_REQUEST, "请填写 DOMjudge 默认比赛 ID");
            }
        }
    }

    private String normalizeJudgeMode(String value) {
        String mode = hasText(value) ? value.trim().toLowerCase() : "docker";
        return switch (mode) {
            case "domjudge", "docker", "unsafe-local" -> mode;
            default -> "docker";
        };
    }

    private String normalizeJudgeModeForUpdate(String value) {
        String mode = hasText(value) ? value.trim().toLowerCase() : "docker";
        return switch (mode) {
            case "domjudge", "docker", "unsafe-local" -> mode;
            default -> throw new BizException(ErrorCode.BAD_REQUEST, "判题模式只能是 domjudge、docker 或 unsafe-local");
        };
    }

    private boolean boolSetting(String key, boolean defaultValue) {
        SystemSetting setting = settingMapper.selectById(key);
        return setting == null ? defaultValue : boolValue(setting.settingValue, defaultValue);
    }

    private String textSetting(String key, String defaultValue) {
        SystemSetting setting = settingMapper.selectById(key);
        if (setting == null || setting.settingValue == null) {
            return defaultValue;
        }
        return setting.settingValue;
    }

    private int positiveIntSetting(String key, int defaultValue) {
        int value = intValue(textSetting(key, null), defaultValue);
        return value > 0 ? value : defaultValue;
    }

    private long positiveLongSetting(String key, long defaultValue) {
        long value = longValue(textSetting(key, null), defaultValue);
        return value > 0 ? value : defaultValue;
    }

    private Map<String, Object> getJsonSetting(String key, Map<String, Object> defaultConfig) {
        SystemSetting setting = settingMapper.selectById(key);
        if (setting == null || setting.settingValue == null || setting.settingValue.isBlank()) {
            return defaultConfig;
        }
        try {
            return objectMapper.readValue(setting.settingValue, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException e) {
            return defaultConfig;
        }
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private String defaultText(Object value, String defaultValue) {
        String text = stringValue(value);
        return hasText(text) ? text : defaultValue;
    }

    private boolean boolValue(Object value, boolean defaultValue) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value instanceof String text && hasText(text)) {
            return Boolean.parseBoolean(text);
        }
        return defaultValue;
    }

    private int intValue(Object value, int defaultValue) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text) {
            return parseIntOrDefault(text, defaultValue);
        }
        return defaultValue;
    }

    private long longValue(Object value, long defaultValue) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String text && hasText(text)) {
            try {
                return Long.parseLong(text.trim());
            } catch (NumberFormatException e) {
                return defaultValue;
            }
        }
        return defaultValue;
    }

    private int parseIntOrDefault(String value, int defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    /**
     * JSON 解析
     */
    private <T> T parseJson(String json, Class<T> clazz) {
        try {
            return objectMapper.readValue(json, clazz);
        } catch (JsonProcessingException e) {
            throw new BizException(ErrorCode.INTERNAL_ERROR, "JSON解析失败: " + e.getMessage());
        }
    }

    private <T> T parseJson(String json, TypeReference<T> typeRef) {
        try {
            return objectMapper.readValue(json, typeRef);
        } catch (JsonProcessingException e) {
            throw new BizException(ErrorCode.INTERNAL_ERROR, "JSON解析失败: " + e.getMessage());
        }
    }

    /**
     * JSON 序列化
     */
    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            throw new BizException(ErrorCode.INTERNAL_ERROR, "JSON序列化失败: " + e.getMessage());
        }
    }
}

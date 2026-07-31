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
import com.qoj.module.setting.vo.CodeTemplateSettingsVO;
import com.qoj.module.setting.vo.FrontendSettingsVO;
import com.qoj.module.setting.vo.JudgeSettingsVO;
import com.qoj.module.setting.vo.PublicJudgeSettingsVO;
import com.qoj.module.setting.vo.OssSettingsVO;
import com.qoj.module.setting.vo.RegisterSettingsVO;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.module.user.mapper.AdminUserMapper;
import com.qoj.security.AuthUser;
import com.qoj.security.SafeUrlValidator;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * System设置业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class SystemSettingService {
    private static final String DEFAULT_EMAIL_SUBJECT = "QOJ 注册验证码";
    private static final String DEFAULT_EMAIL_CONTENT = "您好，\n\n您的验证码是: {{code}}\n\n验证码将在10分钟后过期，请勿泄露给他人。\n\nQOJ Online Judge System";
    private static final String AGENT_CONFIG_KEY = "system.agent_config";
    private static final String OSS_CONFIG_KEY = "system.oss_config";
    private static final String CODE_TEMPLATE_CONFIG_KEY = "system.code_templates";
    private static final int MAX_CODE_TEMPLATE_CHARS = 50000;
    private static final int MAX_CODE_TEMPLATE_CONFIG_BYTES = 60000;
    private static final int DEFAULT_JUDGE_CONCURRENCY = 2;
    private static final int DEFAULT_JUDGE_THREAD_POOL_SIZE = 2;
    private static final int DEFAULT_JUDGE_QUEUE_BATCH_SIZE = 2;
    private static final long DEFAULT_JUDGE_POLL_INTERVAL_MS = 1000L;
    private static final int DEFAULT_CCPCOJ_SESSION_TTL_MINUTES = 720;
    private static final int DEFAULT_CCPCOJ_STALE_TASK_MINUTES = 15;
    private static final Pattern CCPCOJ_USERNAME = Pattern.compile("[A-Za-z0-9._-]{1,60}");
    private static final Pattern CCPCOJ_PASSWORD = Pattern.compile("[A-Za-z0-9._~-]{12,128}");
    private static final Pattern COS_BUCKET = Pattern.compile("[a-z0-9][a-z0-9-]{0,49}-[0-9]{5,20}");
    private static final Pattern COS_REGION = Pattern.compile("[a-z]{2,8}-[a-z0-9-]{2,32}");
    private static final Pattern COS_SECRET_ID = Pattern.compile("AKID[A-Za-z0-9]{16,64}");
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
    private static final Map<String, Object> DEFAULT_CODE_TEMPLATE_CONFIG = Map.of(
        "c", "#include <stdio.h>\n\nint main(void) {\n    return 0;\n}",
        "cpp", "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    return 0;\n}",
        "python", "import sys\n\ndef solve():\n    pass\n\nif __name__ == \"__main__\":\n    solve()\n",
        "java", "import java.io.*;\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n    }\n}",
        "csharp", "using System;\n\npublic static class Program\n{\n    public static void Main()\n    {\n    }\n}"
    );

    private final SystemSettingMapper settingMapper;
    private final AdminUserMapper adminUserMapper;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;
    private final Environment environment;

    /**
     * 构造 System设置Service 实例并保存其必要依赖或初始状态。从持久化层读取数据。
     */
    public SystemSettingService(
        SystemSettingMapper settingMapper,
        AdminUserMapper adminUserMapper,
        PasswordEncoder passwordEncoder,
        ObjectMapper objectMapper,
        Environment environment
    ) {
        this.settingMapper = settingMapper;
        this.adminUserMapper = adminUserMapper;
        this.passwordEncoder = passwordEncoder;
        this.objectMapper = objectMapper;
        this.environment = environment;
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
        vo.ccpcojJudgePassword = "";
        return vo;
    }

    public PublicJudgeSettingsVO getPublicJudgeSettings() {
        JudgeSettingsVO runtime = getJudgeRuntimeSettings();
        /**
         * 封装Public判题SettingsVO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new PublicJudgeSettingsVO(runtime.enabled, runtime.enableSandbox);
    }

    public JudgeSettingsVO getJudgeRuntimeSettings() {
        JudgeSettingsVO vo = new JudgeSettingsVO();
        vo.enabled = boolSetting("judge.enabled", true);
        // Ordinary work is fixed to go-judge; contest ownership is snapshotted
        // from each contest instead of being switched globally at runtime.
        vo.mode = "go-judge";
        vo.contestMode = "per-contest";
        vo.enableSandbox = boolSetting("judge.enable_sandbox", false);
        vo.threadPoolSize = positiveIntSetting("judge.thread_pool_size", DEFAULT_JUDGE_THREAD_POOL_SIZE);
        vo.maxConcurrent = positiveIntSetting("judge.max_concurrent", DEFAULT_JUDGE_CONCURRENCY);
        vo.queueBatchSize = positiveIntSetting("judge.queue_batch_size", DEFAULT_JUDGE_QUEUE_BATCH_SIZE);
        vo.pollIntervalMs = positiveLongSetting("judge.poll_interval_ms", DEFAULT_JUDGE_POLL_INTERVAL_MS);
        vo.ccpcojJudgeUsername = textSetting("judge.ccpcoj_username", "judger");
        vo.ccpcojJudgePassword = textSetting("judge.ccpcoj_password_hash", "");
        vo.hasCcpcojJudgePassword = hasText(vo.ccpcojJudgePassword);
        vo.ccpcojSessionTtlMinutes = positiveIntSetting(
            "judge.ccpcoj_session_ttl_minutes", DEFAULT_CCPCOJ_SESSION_TTL_MINUTES);
        vo.ccpcojStaleTaskMinutes = positiveIntSetting(
            "judge.ccpcoj_stale_task_minutes", DEFAULT_CCPCOJ_STALE_TASK_MINUTES);
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
     * 获取各语言默认代码模板。
     */
    public CodeTemplateSettingsVO getCodeTemplateSettings() {
        Map<String, Object> config = getJsonSetting(CODE_TEMPLATE_CONFIG_KEY, DEFAULT_CODE_TEMPLATE_CONFIG);
        CodeTemplateSettingsVO vo = new CodeTemplateSettingsVO();
        vo.c = codeTemplateValue(config, "c");
        vo.cpp = codeTemplateValue(config, "cpp");
        vo.python = codeTemplateValue(config, "python");
        vo.java = codeTemplateValue(config, "java");
        vo.csharp = codeTemplateValue(config, "csharp");
        return vo;
    }

    /**
     * 判题开关是否已关闭（判题入口与调度器共用此判断）
     */
    public boolean isJudgeEnabled() {
        /**
         * 读取判题Settings并返回给调用方。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
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
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
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
        next.mode = "go-judge";
        next.contestMode = "per-contest";
        next.enableSandbox = request.enableSandbox;
        next.threadPoolSize = request.threadPoolSize;
        next.maxConcurrent = request.maxConcurrent;
        next.queueBatchSize = request.queueBatchSize;
        next.pollIntervalMs = request.pollIntervalMs;
        next.ccpcojJudgeUsername = trimToEmpty(request.ccpcojJudgeUsername);
        if (hasText(next.ccpcojJudgeUsername)
            && !CCPCOJ_USERNAME.matcher(next.ccpcojJudgeUsername).matches()) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常；可能调用外部判题或网关服务。
             */
            throw new BizException(ErrorCode.BAD_REQUEST,
                "CCPCOJ 评测机账号只能包含字母、数字、点、下划线和连字符，且不超过 60 个字符");
        }
        if (hasText(request.ccpcojJudgePassword)
            && !CCPCOJ_PASSWORD.matcher(request.ccpcojJudgePassword.trim()).matches()) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常；可能调用外部判题或网关服务。
             */
            throw new BizException(ErrorCode.BAD_REQUEST,
                "CCPCOJ 评测机密码需为 12-128 位，且只能包含字母、数字、点、下划线、波浪号和连字符");
        }
        next.ccpcojJudgePassword = hasText(request.ccpcojJudgePassword)
            ? passwordEncoder.encode(request.ccpcojJudgePassword.trim())
            : existing.ccpcojJudgePassword;
        next.hasCcpcojJudgePassword = hasText(next.ccpcojJudgePassword);
        next.ccpcojSessionTtlMinutes = request.ccpcojSessionTtlMinutes;
        next.ccpcojStaleTaskMinutes = request.ccpcojStaleTaskMinutes;

        validateJudgeSettings(next);

        String username = authUser.getUsername();
        updateSetting("judge.enabled", String.valueOf(next.enabled), username);
        updateSetting("judge.mode", next.mode, username);
        updateSetting("judge.contest_mode", next.contestMode, username);
        updateSetting("judge.enable_sandbox", String.valueOf(next.enableSandbox), username);
        updateSetting("judge.max_concurrent", String.valueOf(next.maxConcurrent), username);
        updateSetting("judge.thread_pool_size", String.valueOf(next.threadPoolSize), username);
        updateSetting("judge.queue_batch_size", String.valueOf(next.queueBatchSize), username);
        updateSetting("judge.poll_interval_ms", String.valueOf(next.pollIntervalMs), username);
        /**
         * 更新设置。可能调用外部判题或网关服务。
         */
        updateSetting("judge.ccpcoj_username", next.ccpcojJudgeUsername, username);
        /**
         * 更新设置。可能调用外部判题或网关服务。
         */
        updateSetting("judge.ccpcoj_password_hash",
            next.ccpcojJudgePassword == null ? "" : next.ccpcojJudgePassword, username);
        /**
         * 更新设置。可能调用外部判题或网关服务。
         */
        updateSetting("judge.ccpcoj_session_ttl_minutes",
            String.valueOf(next.ccpcojSessionTtlMinutes), username);
        /**
         * 更新设置。可能调用外部判题或网关服务。
         */
        updateSetting("judge.ccpcoj_stale_task_minutes",
            String.valueOf(next.ccpcojStaleTaskMinutes), username);
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
            SafeUrlValidator.requirePublicHttpUrl(next.baseUrl, "AI 服务地址");
            if (!hasText(next.baseUrl)) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(ErrorCode.BAD_REQUEST, "请填写 AI 服务地址");
            }
            if (!hasText(next.apiKey)) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(ErrorCode.BAD_REQUEST, "请填写 AI API Key");
            }
            if (!hasText(next.model)) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(ErrorCode.BAD_REQUEST, "请填写 AI 模型名称");
            }
        }
        if (next.timeoutMs < 1000 || next.timeoutMs > 120000) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, "AI 请求超时时间必须在 1000-120000 毫秒之间");
        }
        if (next.maxCodeChars < 1000 || next.maxCodeChars > 50000) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
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
            if (!hasText(next.bucket)) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(ErrorCode.BAD_REQUEST, "请填写腾讯云 COS Bucket");
            }
            if (!COS_BUCKET.matcher(next.bucket).matches()) {
                throw new BizException(ErrorCode.BAD_REQUEST, "COS Bucket 必须包含 APPID，例如 qoj-1250000000");
            }
            if (!hasText(next.region) || !COS_REGION.matcher(next.region).matches()) {
                throw new BizException(ErrorCode.BAD_REQUEST, "请填写正确的 COS Region，例如 ap-beijing");
            }
            if (!hasText(next.accessKeyId)) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(ErrorCode.BAD_REQUEST, "请填写腾讯云 SecretId");
            }
            if (!COS_SECRET_ID.matcher(next.accessKeyId).matches()) {
                throw new BizException(ErrorCode.BAD_REQUEST, "腾讯云 SecretId 应以 AKID 开头，不能填写 APPID");
            }
            if (!hasText(next.accessKeySecret)) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(ErrorCode.BAD_REQUEST, "请填写腾讯云 SecretKey");
            }
            if (!hasText(next.publicBaseUrl)) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(ErrorCode.BAD_REQUEST, "请填写 COS 公开访问地址");
            }
            validateHttpsBaseUrl(next.publicBaseUrl, "COS 公开访问地址");
            if (hasText(next.endpoint)) {
                validateHttpsBaseUrl(next.endpoint, "COS Endpoint");
            }
        }
        if (next.maxSizeMb < 1 || next.maxSizeMb > 20) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
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
     * 更新各语言默认代码模板。
     */
    @Transactional
    public void updateCodeTemplateSettings(CodeTemplateSettingsVO request, AuthUser authUser) {
        if (request == null) {
            throw new BizException(ErrorCode.BAD_REQUEST, "代码模板不能为空");
        }
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("c", validateCodeTemplate(request.c, "C"));
        config.put("cpp", validateCodeTemplate(request.cpp, "C++"));
        config.put("python", validateCodeTemplate(request.python, "Python"));
        config.put("java", validateCodeTemplate(request.java, "Java"));
        config.put("csharp", validateCodeTemplate(request.csharp, "C#"));
        String serialized = toJson(config);
        if (serialized.getBytes(StandardCharsets.UTF_8).length > MAX_CODE_TEMPLATE_CONFIG_BYTES) {
            throw new BizException(ErrorCode.BAD_REQUEST, "全部默认代码合计不能超过 60000 字节");
        }
        updateSetting(CODE_TEMPLATE_CONFIG_KEY, serialized, authUser.getUsername());
    }

    private void validateHttpsBaseUrl(String value, String label) {
        try {
            URI uri = URI.create(value.trim());
            boolean valid = "https".equalsIgnoreCase(uri.getScheme())
                && uri.getHost() != null
                && uri.getUserInfo() == null
                && uri.getQuery() == null
                && uri.getFragment() == null;
            if (!valid) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException ex) {
            throw new BizException(ErrorCode.BAD_REQUEST, label + "必须是完整的 HTTPS 地址");
        }
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
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND, "管理员不存在");
        }

        if (!passwordEncoder.matches(request.oldPassword, adminUser.passwordHash)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
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
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
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
            case "judge.enable_sandbox" -> "沙箱调试开关";
            case "judge.max_concurrent" -> "判题最大并发数";
            case "judge.thread_pool_size" -> "判题线程池大小";
            case "judge.queue_batch_size" -> "判题队列批量拉取数";
            case "judge.poll_interval_ms" -> "判题队列轮询间隔";
            case "judge.ccpcoj_username" -> "CCPCOJ 评测机账号";
            case "judge.ccpcoj_password_hash" -> "CCPCOJ 评测机密码哈希";
            case "judge.ccpcoj_session_ttl_minutes" -> "CCPCOJ 评测机会话有效期";
            case "judge.ccpcoj_stale_task_minutes" -> "CCPCOJ 任务失联重取时间";
            case AGENT_CONFIG_KEY -> "AI助手配置";
            case OSS_CONFIG_KEY -> "OSS配置";
            case CODE_TEMPLATE_CONFIG_KEY -> "各语言默认代码模板";
            default -> key;
        };
    }

    private void validateJudgeSettings(JudgeSettingsVO settings) {
        if (settings.threadPoolSize <= 0 || settings.threadPoolSize > 64) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, "判题线程池大小必须在 1-64 之间");
        }
        if (settings.maxConcurrent <= 0 || settings.maxConcurrent > settings.threadPoolSize) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST,
                "判题最大并发数必须为正整数且不超过线程池大小 " + settings.threadPoolSize);
        }
        if (settings.queueBatchSize <= 0 || settings.queueBatchSize > 100) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, "队列批量拉取数必须在 1-100 之间");
        }
        if (settings.pollIntervalMs < 200 || settings.pollIntervalMs > 60000) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, "判题队列轮询间隔必须在 200-60000 毫秒之间");
        }
        if (settings.ccpcojSessionTtlMinutes < 10 || settings.ccpcojSessionTtlMinutes > 10080) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常；可能调用外部判题或网关服务。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, "CCPCOJ 会话有效期必须在 10-10080 分钟之间");
        }
        if (settings.ccpcojStaleTaskMinutes < 2 || settings.ccpcojStaleTaskMinutes > 1440) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常；可能调用外部判题或网关服务。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, "CCPCOJ 任务失联时间必须在 2-1440 分钟之间");
        }
        if (!"go-judge".equals(settings.mode) || !"per-contest".equals(settings.contestMode)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, "普通判题必须使用 go-judge，比赛判题必须按比赛配置");
        }
        if (!hasText(settings.ccpcojJudgeUsername)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常；可能调用外部判题或网关服务。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, "请填写 CCPCOJ 评测机账号");
        }
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

    private String codeTemplateValue(Map<String, Object> config, String language) {
        if (config.containsKey(language)) {
            return stringValue(config.get(language));
        }
        return stringValue(DEFAULT_CODE_TEMPLATE_CONFIG.get(language));
    }

    private String validateCodeTemplate(String value, String language) {
        String template = value == null ? "" : value;
        if (template.length() > MAX_CODE_TEMPLATE_CHARS) {
            throw new BizException(ErrorCode.BAD_REQUEST,
                language + " 默认代码不能超过 " + MAX_CODE_TEMPLATE_CHARS + " 个字符");
        }
        return template;
    }

    private String defaultText(Object value, String defaultValue) {
        String text = stringValue(value);
        /**
         * 判断Text是否成立。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
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
            /**
             * 解析并规范化IntOr默认值。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
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
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.INTERNAL_ERROR, "JSON解析失败: " + e.getMessage());
        }
    }

    private <T> T parseJson(String json, TypeReference<T> typeRef) {
        try {
            return objectMapper.readValue(json, typeRef);
        } catch (JsonProcessingException e) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
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
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.INTERNAL_ERROR, "JSON序列化失败: " + e.getMessage());
        }
    }
}

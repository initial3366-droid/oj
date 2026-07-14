package com.qoj.config;

import jakarta.annotation.PostConstruct;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.EnvironmentAware;
import org.springframework.core.env.Environment;

/**
 * Environment-backed security and infrastructure settings.
 *
 * <p>Judge endpoint credentials deliberately live outside the database so an
 * administrator account cannot redirect code execution traffic to an arbitrary
 * host. Only the deployment environment may change the go-judge destination.
 */
@ConfigurationProperties(prefix = "qoj")
public class QojProperties implements EnvironmentAware {
    private static final Pattern SERVICE_TOKEN = Pattern.compile("[A-Za-z0-9._~-]{32,256}");
    private Jwt jwt = new Jwt();
    private Cors cors = new Cors();
    private GoJudge goJudge = new GoJudge();
    private Environment environment;

    /**
     * 封装setEnvironment相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Override
    public void setEnvironment(Environment environment) {
        this.environment = environment;
    }

    /**
     * 校验前置条件。可能调用外部判题或网关服务。
     */
    @PostConstruct
    public void validate() {
        validateJwt();
        /**
         * 校验Go判题。可能调用外部判题或网关服务。
         */
        validateGoJudge();
    }

    /**
     * 校验Jwt。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private void validateJwt() {
        if (jwt == null || jwt.secret == null || jwt.secret.isBlank()) {
            /**
             * 封装IllegalStateException相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            throw new IllegalStateException("JWT_SECRET 未配置");
        }
        int secretLength = jwt.secret.getBytes(StandardCharsets.UTF_8).length;
        if (secretLength < 32) {
            String message = "JWT_SECRET 长度不足，至少需要 32 字节";
            if (isProduction()) {
                /**
                 * 封装IllegalStateException相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
                 */
                throw new IllegalStateException("【生产环境启动失败】" + message);
            }
            System.err.println("【安全警告】" + message);
        }
        if (jwt.secret.contains("change-this") || jwt.secret.contains("default")) {
            String message = "JWT_SECRET 使用了默认值";
            if (isProduction()) {
                /**
                 * 封装IllegalStateException相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
                 */
                throw new IllegalStateException("【生产环境启动失败】" + message);
            }
            System.err.println("【安全警告】" + message);
        }
    }

    /**
     * 校验Go判题。不满足业务约束时直接抛出明确异常；可能调用外部判题或网关服务。
     */
    private void validateGoJudge() {
        if (goJudge == null || goJudge.baseUrl == null || goJudge.baseUrl.isBlank()) {
            /**
             * 封装IllegalStateException相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            throw new IllegalStateException("GO_JUDGE_BASE_URL 未配置");
        }
        URI uri;
        try {
            uri = URI.create(goJudge.baseUrl.trim());
        } catch (IllegalArgumentException ex) {
            /**
             * 封装IllegalStateException相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            throw new IllegalStateException("GO_JUDGE_BASE_URL 格式错误", ex);
        }
        boolean validScheme = "http".equalsIgnoreCase(uri.getScheme())
            || "https".equalsIgnoreCase(uri.getScheme());
        boolean rootPath = uri.getPath() == null || uri.getPath().isBlank() || "/".equals(uri.getPath());
        if (!validScheme || uri.getHost() == null || uri.getUserInfo() != null
            || uri.getQuery() != null || uri.getFragment() != null || !rootPath) {
            /**
             * 封装IllegalStateException相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            throw new IllegalStateException("GO_JUDGE_BASE_URL 必须是无账号、查询参数和子路径的 HTTP(S) 地址");
        }
        /**
         * 校验Range。可能调用外部判题或网关服务。
         */
        requireRange(goJudge.connectTimeoutMs, 100, 30000, "GO_JUDGE_CONNECT_TIMEOUT_MS");
        /**
         * 校验Range。可能调用外部判题或网关服务。
         */
        requireRange(goJudge.requestTimeoutMs, 1000, 300000, "GO_JUDGE_REQUEST_TIMEOUT_MS");
        /**
         * 校验Range。可能调用外部判题或网关服务。
         */
        requireRange(goJudge.compileTimeoutMs, 1000, 60000, "GO_JUDGE_COMPILE_TIMEOUT_MS");
        /**
         * 校验Range。可能调用外部判题或网关服务。
         */
        requireRange(goJudge.maxSourceBytes, 1024, 1024 * 1024, "GO_JUDGE_MAX_SOURCE_BYTES");
        /**
         * 校验Range。可能调用外部判题或网关服务。
         */
        requireRange(goJudge.maxInputBytes, 1024, 4 * 1024 * 1024, "GO_JUDGE_MAX_INPUT_BYTES");
        /**
         * 校验Range。可能调用外部判题或网关服务。
         */
        requireRange(goJudge.maxOutputBytes, 1024, 4 * 1024 * 1024, "GO_JUDGE_MAX_OUTPUT_BYTES");
        /**
         * 校验Range。可能调用外部判题或网关服务。
         */
        requireRange(goJudge.maxProcesses, 1, 128, "GO_JUDGE_MAX_PROCESSES");
        if (goJudge.authToken != null && !goJudge.authToken.isBlank()
            && !SERVICE_TOKEN.matcher(goJudge.authToken).matches()) {
            /**
             * 封装IllegalStateException相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            throw new IllegalStateException("GO_JUDGE_AUTH_TOKEN 必须为 32-256 位安全字符");
        }
        if (isProduction() && (goJudge.authToken == null || goJudge.authToken.isBlank())) {
            /**
             * 封装IllegalStateException相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            throw new IllegalStateException("【生产环境启动失败】GO_JUDGE_AUTH_TOKEN 至少需要 32 个字符");
        }
    }

    /**
     * 校验Range。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private void requireRange(int value, int min, int max, String name) {
        if (value < min || value > max) {
            /**
             * 封装IllegalStateException相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            throw new IllegalStateException(name + " 必须在 " + min + "-" + max + " 之间");
        }
    }

    /**
     * 判断Production是否成立。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private boolean isProduction() {
        if (environment != null) {
            // Spring Boot command-line options live in Environment rather than JVM system properties.
            return hasProductionProfile(environment.getActiveProfiles());
        }
        // Preserve direct construction for focused unit tests and non-Spring utilities.
        String profiles = System.getProperty(
            "spring.profiles.active",
            System.getenv().getOrDefault("SPRING_PROFILES_ACTIVE", "dev")
        );
        /**
         * 判断Production资料是否成立。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return hasProductionProfile(profiles.split(","));
    }

    /**
     * 判断Production资料是否成立。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private boolean hasProductionProfile(String[] profiles) {
        return Arrays.stream(profiles)
            .map(String::trim)
            .anyMatch(value -> "prod".equalsIgnoreCase(value) || "production".equalsIgnoreCase(value));
    }

    /**
     * 读取Jwt并返回给调用方。直接返回当前实例保存的jwt，不产生额外的数据写入。
     */
    public Jwt getJwt() {
        return jwt;
    }

    /**
     * 封装setJwt相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public void setJwt(Jwt jwt) {
        this.jwt = jwt;
    }

    /**
     * 读取Cors并返回给调用方。直接返回当前实例保存的cors，不产生额外的数据写入。
     */
    public Cors getCors() {
        return cors;
    }

    /**
     * 封装setCors相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public void setCors(Cors cors) {
        this.cors = cors;
    }

    /**
     * 读取Go判题并返回给调用方。直接返回当前实例保存的go判题，不产生额外的数据写入。
     */
    public GoJudge getGoJudge() {
        return goJudge;
    }

    /**
     * 封装setGo判题相关逻辑。可能调用外部判题或网关服务。
     */
    public void setGoJudge(GoJudge goJudge) {
        this.goJudge = goJudge;
    }

    /**
     * Jwt配置类型。集中声明运行参数或 Spring 组件装配规则。
     */
    public static class Jwt {
        private String secret;
        private long accessTokenTtlSeconds;
        private long refreshTokenTtlSeconds;

        /**
         * 读取Secret并返回给调用方。直接返回当前实例保存的secret，不产生额外的数据写入。
         */
        public String getSecret() { return secret; }
        public void setSecret(String secret) { this.secret = secret; }
        public long getAccessTokenTtlSeconds() { return accessTokenTtlSeconds; }
        public void setAccessTokenTtlSeconds(long value) { this.accessTokenTtlSeconds = value; }
        public long getRefreshTokenTtlSeconds() { return refreshTokenTtlSeconds; }
        public void setRefreshTokenTtlSeconds(long value) { this.refreshTokenTtlSeconds = value; }
    }

    /**
     * Cors配置类型。集中声明运行参数或 Spring 组件装配规则。
     */
    public static class Cors {
        private List<String> allowedOrigins = List.of();

        /**
         * 读取AllowedOrigins并返回给调用方。可能调用外部判题或网关服务。
         */
        public List<String> getAllowedOrigins() { return allowedOrigins; }
        public void setAllowedOrigins(List<String> allowedOrigins) { this.allowedOrigins = allowedOrigins; }
    }

    /** Fixed deployment configuration for the internal go-judge HTTP service. */
    public static class GoJudge {
        private String baseUrl = "http://127.0.0.1:15050";
        private String authToken = "";
        private int connectTimeoutMs = 2000;
        private int requestTimeoutMs = 200000;
        private int compileTimeoutMs = 20000;
        private int maxSourceBytes = 65536;
        private int maxInputBytes = 2 * 1024 * 1024;
        private int maxOutputBytes = 2 * 1024 * 1024;
        private int maxProcesses = 32;

        public String getBaseUrl() { return baseUrl; }
        public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
        public String getAuthToken() { return authToken; }
        public void setAuthToken(String authToken) { this.authToken = authToken; }
        public int getConnectTimeoutMs() { return connectTimeoutMs; }
        public void setConnectTimeoutMs(int value) { this.connectTimeoutMs = value; }
        public int getRequestTimeoutMs() { return requestTimeoutMs; }
        public void setRequestTimeoutMs(int value) { this.requestTimeoutMs = value; }
        public int getCompileTimeoutMs() { return compileTimeoutMs; }
        public void setCompileTimeoutMs(int value) { this.compileTimeoutMs = value; }
        public int getMaxSourceBytes() { return maxSourceBytes; }
        public void setMaxSourceBytes(int value) { this.maxSourceBytes = value; }
        public int getMaxInputBytes() { return maxInputBytes; }
        public void setMaxInputBytes(int value) { this.maxInputBytes = value; }
        public int getMaxOutputBytes() { return maxOutputBytes; }
        public void setMaxOutputBytes(int value) { this.maxOutputBytes = value; }
        public int getMaxProcesses() { return maxProcesses; }
        public void setMaxProcesses(int value) { this.maxProcesses = value; }
    }
}

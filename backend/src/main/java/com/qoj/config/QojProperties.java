package com.qoj.config;

import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "qoj")
public class QojProperties {
    private Jwt jwt = new Jwt();
    private Cors cors = new Cors();
    private Domjudge domjudge = new Domjudge();
    private Judge judge = new Judge();

    @PostConstruct
    public void validate() {
        if (jwt == null || jwt.secret == null || jwt.secret.isBlank()) {
            throw new IllegalStateException(
                "JWT_SECRET 未配置。请在环境变量或配置文件中设置 JWT_SECRET"
            );
        }

        int secretLength = jwt.secret.getBytes(StandardCharsets.UTF_8).length;

        // 开发环境警告，生产环境强制要求
        String activeProfile = System.getProperty("spring.profiles.active", "dev");
        boolean isProduction = "prod".equalsIgnoreCase(activeProfile) ||
                              "production".equalsIgnoreCase(activeProfile);

        if (secretLength < 32) {
            String message = String.format(
                "JWT_SECRET 长度不足！当前: %d 字节，要求: 至少 32 字节。" +
                "HS512 算法建议使用 64 字节以上的密钥。",
                secretLength
            );

            if (isProduction) {
                throw new IllegalStateException("【生产环境启动失败】" + message);
            } else {
                System.err.println("⚠️ 【安全警告】" + message);
            }
        }

        if (secretLength < 64) {
            System.err.println(String.format(
                "⚠️ 【安全建议】JWT_SECRET 当前长度 %d 字节，HS512 算法建议至少 64 字节",
                secretLength
            ));
        }

        // 检查是否使用了默认值
        if (jwt.secret.contains("change-this") || jwt.secret.contains("default")) {
            String message = "JWT_SECRET 使用了默认值！生产环境必须修改为强随机密钥。";
            if (isProduction) {
                throw new IllegalStateException("【生产环境启动失败】" + message);
            } else {
                System.err.println("⚠️ 【安全警告】" + message);
            }
        }

    }

    public Jwt getJwt() {
        return jwt;
    }

    public void setJwt(Jwt jwt) {
        this.jwt = jwt;
    }

    public Cors getCors() {
        return cors;
    }

    public void setCors(Cors cors) {
        this.cors = cors;
    }

    public Domjudge getDomjudge() {
        return domjudge;
    }

    public void setDomjudge(Domjudge domjudge) {
        this.domjudge = domjudge;
    }

    public Judge getJudge() {
        return judge;
    }

    public void setJudge(Judge judge) {
        this.judge = judge;
    }

    public static class Jwt {
        private String secret;
        private long accessTokenTtlSeconds;
        private long refreshTokenTtlSeconds;

        public String getSecret() {
            return secret;
        }

        public void setSecret(String secret) {
            this.secret = secret;
        }

        public long getAccessTokenTtlSeconds() {
            return accessTokenTtlSeconds;
        }

        public void setAccessTokenTtlSeconds(long accessTokenTtlSeconds) {
            this.accessTokenTtlSeconds = accessTokenTtlSeconds;
        }

        public long getRefreshTokenTtlSeconds() {
            return refreshTokenTtlSeconds;
        }

        public void setRefreshTokenTtlSeconds(long refreshTokenTtlSeconds) {
            this.refreshTokenTtlSeconds = refreshTokenTtlSeconds;
        }
    }

    public static class Cors {
        private List<String> allowedOrigins = List.of();

        public List<String> getAllowedOrigins() {
            return allowedOrigins;
        }

        public void setAllowedOrigins(List<String> allowedOrigins) {
            this.allowedOrigins = allowedOrigins;
        }
    }

    public static class Domjudge {
        private String baseUrl;
        private String apiKey;
        private String contestId;
        private long pollIntervalMs;

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
        }

        public String getApiKey() {
            return apiKey;
        }

        public void setApiKey(String apiKey) {
            this.apiKey = apiKey;
        }

        public String getContestId() {
            return contestId;
        }

        public void setContestId(String contestId) {
            this.contestId = contestId;
        }

        public long getPollIntervalMs() {
            return pollIntervalMs;
        }

        public void setPollIntervalMs(long pollIntervalMs) {
            this.pollIntervalMs = pollIntervalMs;
        }
    }

    public static class Judge {
        /**
         * ⚠️ 不安全的本地判题开关（仅开发环境）
         *
         * 启用后会直接在主服务器上执行用户代码，存在严重安全风险：
         * - 用户代码可访问文件系统
         * - 用户代码可创建网络连接
         * - 用户代码可消耗系统资源
         * - 没有任何隔离机制
         *
         * ⚠️ 生产环境严禁启用
         *
         * 使用方式：qoj.judge.enable-unsafe-local-judge=true
         */
        private boolean enableUnsafeLocalJudge = false;

        /**
         * 判题模式
         *
         * 支持的值：
         * - domjudge (推荐) - 使用DOMjudge远程判题
         * - docker - 使用Docker容器隔离判题
         *
         * 生产环境必须使用 domjudge 或 docker
         */
        private String mode = "domjudge";

        /**
         * 沙箱调试开关（代码运行功能）
         *
         * 启用后允许用户在前端使用"运行"功能测试代码
         * 必须配合 Docker 或其他安全隔离机制使用
         */
        private boolean enableSandbox = false;
        private long pollIntervalMs = 1000;
        private int maxConcurrent = 2;
        private int threadPoolSize = 2;
        private int queueBatchSize = 2;

        public boolean isEnableUnsafeLocalJudge() {
            return enableUnsafeLocalJudge;
        }

        public void setEnableUnsafeLocalJudge(boolean enableUnsafeLocalJudge) {
            this.enableUnsafeLocalJudge = enableUnsafeLocalJudge;
        }

        public String getMode() {
            return mode;
        }

        public void setMode(String mode) {
            this.mode = mode;
        }

        public boolean isEnableSandbox() {
            return enableSandbox;
        }

        public long getPollIntervalMs() {
            return pollIntervalMs;
        }

        public void setPollIntervalMs(long pollIntervalMs) {
            this.pollIntervalMs = pollIntervalMs;
        }

        public int getMaxConcurrent() {
            return maxConcurrent;
        }

        public void setMaxConcurrent(int maxConcurrent) {
            this.maxConcurrent = maxConcurrent;
        }

        public int getThreadPoolSize() {
            return threadPoolSize;
        }

        public void setThreadPoolSize(int threadPoolSize) {
            this.threadPoolSize = threadPoolSize;
        }

        public int getQueueBatchSize() {
            return queueBatchSize;
        }

        public void setQueueBatchSize(int queueBatchSize) {
            this.queueBatchSize = queueBatchSize;
        }

        public void setEnableSandbox(boolean enableSandbox) {
            this.enableSandbox = enableSandbox;
        }
    }
}

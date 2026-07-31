package com.qoj.config;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.Banner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Configuration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * QOJProperties配置类型。集中声明运行参数或 Spring 组件装配规则。
 */
class QojPropertiesTest {
    private static final String STRONG_SECRET =
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    private static final String SERVICE_TOKEN =
        "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

    /**
     * 封装standardCommandLineProd资料Rejects默认值JwtSecret相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Test
    void standardCommandLineProdProfileRejectsDefaultJwtSecret() {
        RuntimeException exception = assertThrows(RuntimeException.class, () -> runApplication(
            "--spring.profiles.active=prod",
            "--qoj.jwt.secret=change-this-secret-to-at-least-32-bytes",
            "--qoj.go-judge.auth-token=" + SERVICE_TOKEN
        ));

        assertEquals("【生产环境启动失败】JWT_SECRET 使用了默认值", rootCause(exception).getMessage());
    }

    /**
     * 封装standardCommandLineProd资料RejectsBlankGo判题令牌相关逻辑。可能调用外部判题或网关服务。
     */
    @Test
    void standardCommandLineProdProfileRejectsBlankGoJudgeToken() {
        RuntimeException exception = assertThrows(RuntimeException.class, () -> runApplication(
            "--spring.profiles.active=prod",
            "--qoj.jwt.secret=" + STRONG_SECRET,
            "--qoj.go-judge.auth-token="
        ));

        assertEquals(
            "【生产环境启动失败】GO_JUDGE_AUTH_TOKEN 至少需要 32 个字符",
            rootCause(exception).getMessage()
        );
    }

    /**
     * 封装directConstructionStillProvides默认值NestedConfiguration相关逻辑。可能调用外部判题或网关服务。
     */
    @Test
    void directConstructionStillProvidesDefaultNestedConfiguration() {
        QojProperties properties = new QojProperties();

        assertNotNull(properties.getJwt());
        assertNotNull(properties.getCors());
        assertNotNull(properties.getGoJudge());
    }

    /**
     * 封装runApplication相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private void runApplication(String... args) {
        SpringApplication application = new SpringApplication(TestConfiguration.class);
        application.setBannerMode(Banner.Mode.OFF);
        application.setLogStartupInfo(false);
        application.setRegisterShutdownHook(false);
        application.setWebApplicationType(WebApplicationType.NONE);
        application.setDefaultProperties(Map.of("logging.level.root", "OFF"));
        try (ConfigurableApplicationContext ignored = application.run(args)) {
            // A successful context is closed immediately; failure is asserted by the caller.
        }
    }

    /**
     * 封装rootCause相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private Throwable rootCause(Throwable throwable) {
        Throwable result = throwable;
        while (result.getCause() != null) {
            result = result.getCause();
        }
        return result;
    }

    /**
     * Test配置类型。集中声明运行参数或 Spring 组件装配规则。
     */
    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(QojProperties.class)
    static class TestConfiguration {
    }
}

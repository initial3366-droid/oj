/**
 * QOJ 根包源码。该文件的结构化注释用于说明职责边界，便于后续人工审阅与维护。
 */
package com.qoj;

import java.util.TimeZone;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * QOJ应用入口。完成 Spring Boot 启动、组件扫描及进程级基础配置。
 */
@SpringBootApplication
@EnableScheduling
@MapperScan("com.qoj.module.*.mapper")
public class QojApplication {
    private static final String DEFAULT_TIME_ZONE = "Asia/Shanghai";

    /**
     * 启动 QOJ 应用，应用进程级时区配置后交由 Spring Boot 创建运行上下文。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static void main(String[] args) {
        String timeZone = System.getenv().getOrDefault("QOJ_TIME_ZONE", DEFAULT_TIME_ZONE);
        System.setProperty("user.timezone", timeZone);
        TimeZone.setDefault(TimeZone.getTimeZone(timeZone));
        SpringApplication.run(QojApplication.class, args);
    }
}

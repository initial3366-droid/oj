/**
 * QOJ 根包源码。该文件的结构化注释用于说明职责边界，便于后续人工审阅与维护。
 */
package com.qoj;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * TestPasswordGen领域类型。封装 com.qoj 模块内的相关职责。
 */
public class TestPasswordGen {
    /**
     * 启动 QOJ 应用，应用进程级时区配置后交由 Spring Boot 创建运行上下文。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
        System.out.println("admin123: " + encoder.encode("admin123"));
        System.out.println("password: " + encoder.encode("password"));
    }
}

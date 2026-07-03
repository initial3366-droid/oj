package com.qoj;

import java.util.TimeZone;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@MapperScan("com.qoj.module.*.mapper")
public class QojApplication {
    private static final String DEFAULT_TIME_ZONE = "Asia/Shanghai";

    public static void main(String[] args) {
        String timeZone = System.getenv().getOrDefault("QOJ_TIME_ZONE", DEFAULT_TIME_ZONE);
        System.setProperty("user.timezone", timeZone);
        TimeZone.setDefault(TimeZone.getTimeZone(timeZone));
        SpringApplication.run(QojApplication.class, args);
    }
}

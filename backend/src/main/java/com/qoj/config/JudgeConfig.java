package com.qoj.config;

import java.util.concurrent.ThreadPoolExecutor;
import com.qoj.module.setting.service.SystemSettingService;
import com.qoj.module.setting.vo.JudgeSettingsVO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * 判题队列调度线程池配置
 *
 * 固定大小线程池，不允许无限创建线程。
 * 线程池大小由 system_settings 中的 judge.thread_pool_size 控制。
 */
@Configuration
@EnableScheduling
public class JudgeConfig {
    private static final Logger log = LoggerFactory.getLogger(JudgeConfig.class);

    private final SystemSettingService settingService;

    public JudgeConfig(SystemSettingService settingService) {
        this.settingService = settingService;
    }

    @Bean(name = "judgeTaskExecutor")
    public ThreadPoolTaskExecutor judgeTaskExecutor() {
        JudgeSettingsVO judgeSettings = settingService.getJudgeSettings();
        int poolSize = judgeSettings.threadPoolSize;
        if (poolSize <= 0) {
            poolSize = 2;
        }

        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(poolSize);
        executor.setMaxPoolSize(poolSize);  // 固定大小，不允许超过
        executor.setQueueCapacity(100);     // 等待队列容量
        executor.setThreadNamePrefix("judge-worker-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();

        log.info("Judge thread pool initialized: core={}, max={}, queueCapacity={}",
            poolSize, poolSize, 100);
        return executor;
    }
}
